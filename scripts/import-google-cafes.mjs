#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, writeBatch, doc, serverTimestamp } from 'firebase/firestore';

const projectRoot = process.cwd();
const envFilePath = path.join(projectRoot, 'src', 'environments', 'environment.ts');

const KNOWN_APP_ID_BY_TITLE = {
  'Cafe Dũng Bụi': 11,
  'S Coffee Roastery': 12,
  'Vườn Sen Coffee': 13,
  'Tiệm cafe Người Thương Ơi': 14,
  'Là Việt Coffee': 3,
};

function getArgValue(flag) {
  const index = process.argv.findIndex((arg) => arg === flag || arg.startsWith(`${flag}=`));
  if (index === -1) {
    return '';
  }

  const value = process.argv[index];
  if (value.includes('=')) {
    return value.split('=').slice(1).join('=').trim();
  }

  return process.argv[index + 1]?.trim() ?? '';
}

function sanitizeSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parsePriceRange(price) {
  if (!price) {
    return '10000-100000';
  }

  const cleaned = String(price).replace(/\./g, '').replace(/\s/g, '');
  const match = cleaned.match(/(\d+)-?(\d+)?/);
  if (!match) {
    return '10000-100000';
  }

  const min = Number.parseInt(match[1], 10);
  const max = Number.parseInt(match[2] ?? match[1], 10);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return '10000-100000';
  }

  return `${Math.min(min, max)}-${Math.max(min, max)}`;
}

function parseOpenTime(openingHours) {
  if (!Array.isArray(openingHours) || !openingHours.length) {
    return '';
  }

  const first = openingHours.find((item) => typeof item?.hours === 'string' && item.hours.trim().length > 0);
  if (!first?.hours) {
    return '';
  }

  if (first.hours.includes('to')) {
    return first.hours.replace(/\s*to\s*/i, '-');
  }

  return first.hours;
}

function extractAmenities(additionalInfo) {
  if (!additionalInfo || typeof additionalInfo !== 'object') {
    return [];
  }

  const amenities = [];
  for (const groups of Object.values(additionalInfo)) {
    if (!Array.isArray(groups)) {
      continue;
    }

    for (const item of groups) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      for (const [label, enabled] of Object.entries(item)) {
        if (enabled === true) {
          amenities.push(sanitizeSlug(label));
        }
      }
    }
  }

  return [...new Set(amenities)].filter(Boolean);
}

async function readEnvironmentSource() {
  try {
    return await fs.readFile(envFilePath, 'utf8');
  } catch {
    return '';
  }
}

async function getFirebaseConfig() {
  const envFile = await readEnvironmentSource();
  const firebaseBlockMatch = envFile.match(/firebase\s*:\s*\{([\s\S]*?)\}\s*as\s*FirebaseOptions/m);
  if (!firebaseBlockMatch) {
    return null;
  }

  const block = firebaseBlockMatch[1];
  const getValue = (key) => {
    const match = block.match(new RegExp(`${key}\\s*:\\s*'([^']*)'`));
    return match?.[1]?.trim() ?? '';
  };

  const config = {
    apiKey: process.env.FIREBASE_WEB_API_KEY?.trim() || getValue('apiKey'),
    authDomain: getValue('authDomain'),
    projectId: process.env.FIREBASE_PROJECT_ID?.trim() || getValue('projectId'),
    databaseURL: process.env.FIREBASE_DATABASE_URL?.trim() || getValue('databaseURL'),
    storageBucket: getValue('storageBucket'),
    messagingSenderId: getValue('messagingSenderId'),
    appId: getValue('appId'),
    measurementId: getValue('measurementId'),
  };

  if (!config.apiKey || !config.projectId || !config.appId) {
    return null;
  }

  return config;
}

async function writePlaceResourceToRealtimeDb(databaseUrl, key, resourceName) {
  if (!databaseUrl || !key || !resourceName) {
    return;
  }

  const normalizedUrl = databaseUrl.replace(/\/$/, '');
  const endpoint = `${normalizedUrl}/shared/googlePlaceResourceByAppId/${encodeURIComponent(String(key))}.json`;

  await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(resourceName),
  });
}

function buildCafeDoc(item, appId, docId) {
  const lat = Number(item?.location?.lat);
  const lng = Number(item?.location?.lng);

  const city =
    (item.city && String(item.city).trim()) ||
    (item.state && String(item.state).trim()) ||
    'Da Lat';

  const imageGallery = Array.isArray(item.imageUrls) && item.imageUrls.length
    ? item.imageUrls
    : item.imageUrl
      ? [item.imageUrl]
      : [];

  return {
    id: docId,
    appId,
    name: item.title || 'Unnamed cafe',
    slug: sanitizeSlug(item.title || docId),
    city,
    address: item.address || '',
    styleTags: Array.isArray(item.categories)
      ? item.categories.map((category) => sanitizeSlug(category)).filter(Boolean)
      : [],
    chainBrand: false,
    popularChain: false,
    rating: Number(item.totalScore) || 0,
    priceRange: parsePriceRange(item.price),
    openTime: parseOpenTime(item.openingHours),
    contactPhone: item.phoneUnformatted || item.phone || '',
    description: item.description || item.popularTimesLiveText || '',
    heroImage: item.imageUrl || imageGallery[0] || 'assets/images/login.jpg',
    imageGallery,
    amenities: extractAmenities(item.additionalInfo),
    location: {
      lat: Number.isFinite(lat) ? lat : 11.94,
      lng: Number.isFinite(lng) ? lng : 108.43,
    },
    isFeatured: true,
    status: 'active',
    googlePlaceId: item.placeId || '',
    website: item.website || '',
    categoriesRaw: Array.isArray(item.categories) ? item.categories : [],
    reviewsCount: Number(item.reviewsCount) || 0,
    importedAtIso: new Date().toISOString(),
  };
}

function buildReviewCacheDoc(item, appId) {
  const reviews = Array.isArray(item.reviews)
    ? item.reviews.map((review) => ({
      authorName: review?.name || 'Nguoi dung Google',
      authorPhotoUri: review?.reviewerPhotoUrl || '',
      rating: Number(review?.stars) || 0,
      publishTime: review?.publishedAtDate || '',
      relativePublishTimeDescription: review?.publishAt || '',
      text: review?.textTranslated || review?.text || '',
    }))
    : [];

  return {
    appId,
    placeResourceName: item.placeId ? `places/${item.placeId}` : '',
    rating: Number(item.totalScore) || 0,
    reviewCount: Number(item.reviewsCount) || reviews.length,
    reviews,
    syncedAtIso: item.scrapedAt || new Date().toISOString(),
  };
}

async function commitChunk(db, chunk) {
  const batch = writeBatch(db);

  for (const item of chunk) {
    const appId = KNOWN_APP_ID_BY_TITLE[item.title] || null;
    const docId = item.placeId || sanitizeSlug(item.title) || `cafe-${Date.now()}`;

    const cafeDoc = buildCafeDoc(item, appId, docId);
    const cafeRef = doc(db, 'cafes', docId);
    batch.set(cafeRef, {
      ...cafeDoc,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });

    const reviewCacheDoc = buildReviewCacheDoc(item, appId || docId);
    if (reviewCacheDoc.placeResourceName) {
      const reviewRef = doc(db, 'shared_google_place_reviews', String(appId || docId));
      batch.set(reviewRef, {
        ...reviewCacheDoc,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  }

  await batch.commit();
}

async function main() {
  const inputArg = getArgValue('--input') || getArgValue('-i');
  const inputPath = inputArg
    ? path.resolve(projectRoot, inputArg)
    : path.join(projectRoot, 'scripts', 'data', 'cafes-import.json');

  const firebaseConfig = await getFirebaseConfig();
  if (!firebaseConfig) {
    throw new Error('Khong doc duoc Firebase config tu environment.ts');
  }

  const raw = await fs.readFile(inputPath, 'utf8');
  const payload = JSON.parse(raw);
  if (!Array.isArray(payload) || !payload.length) {
    throw new Error('Input JSON phai la mot array va khong duoc rong.');
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const chunkSize = 350;
  for (let index = 0; index < payload.length; index += chunkSize) {
    const chunk = payload.slice(index, index + chunkSize);
    await commitChunk(db, chunk);
    console.log(`Da import chunk ${Math.floor(index / chunkSize) + 1}, so ban ghi: ${chunk.length}`);
  }

  for (const item of payload) {
    const appId = KNOWN_APP_ID_BY_TITLE[item.title] || null;
    const docId = item.placeId || sanitizeSlug(item.title);
    const resourceName = item.placeId ? `places/${item.placeId}` : '';

    if (!resourceName) {
      continue;
    }

    await writePlaceResourceToRealtimeDb(firebaseConfig.databaseURL, appId || docId, resourceName);
    if (appId) {
      await writePlaceResourceToRealtimeDb(firebaseConfig.databaseURL, docId, resourceName);
    }
  }

  console.log(`Import hoan tat: ${payload.length} quan.`);
  console.log('Da cap nhat cafes + shared_google_place_reviews + shared/googlePlaceResourceByAppId.');
}

main().catch((error) => {
  console.error('Import that bai:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
