#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, writeBatch, doc, serverTimestamp } from 'firebase/firestore';

const projectRoot = process.cwd();
const envFilePath = path.join(projectRoot, 'src', 'environments', 'environment.ts');

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

  const cleaned = String(price)
    .replace(/[^\d-]/g, '')
    .replace(/\./g, '')
    .replace(/\s/g, '');
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

function extractAmenities(additionalInfo) {
  if (!additionalInfo || typeof additionalInfo !== 'object') {
    return [];
  }

  const amenities = [];
  const amenitiesArray = additionalInfo.Amenities || [];
  
  if (Array.isArray(amenitiesArray)) {
    for (const item of amenitiesArray) {
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

function parsePriceToNumber(priceStr) {
  if (!priceStr) {
    return 0;
  }

  const cleaned = String(priceStr)
    .replace(/[^\d.]/g, '')
    .trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? Math.ceil(num) : 0;
}

function buildHomestayDoc(item, docId) {
  const lat = Number(item?.location?.lat);
  const lng = Number(item?.location?.lng);

  const city =
    (item.city && String(item.city).trim()) ||
    (item.state && String(item.state).trim()) ||
    (item.neighborhood && String(item.neighborhood).trim()) ||
    'Da Lat';

  const imageGallery = Array.isArray(item.imageUrls) && item.imageUrls.length
    ? item.imageUrls
    : item.imageUrl
      ? [item.imageUrl]
      : [];

  return {
    id: docId,
    name: item.title || 'Unnamed homestay',
    slug: sanitizeSlug(item.title || docId),
    city,
    address: item.address || '',
    styleTags: Array.isArray(item.categories)
      ? item.categories.map((cat) => sanitizeSlug(cat)).filter(Boolean)
      : [],
    placeType: item.categoryName || 'Homestay',
    rating: Number(item.totalScore) || 0,
    priceRange: parsePriceRange(item.price),
    pricePerNight: parsePriceToNumber(item.price),
    priceDisplay: String(item.price || ''),
    contactPhone: item.phoneUnformatted || item.phone || '',
    description: item.description || '',
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
    reviewsCount: Number(item.reviewsCount) || 0,
    importedAtIso: new Date().toISOString(),
  };
}

function buildUniqueDocId(item, index, duplicateCounter) {
  const baseDocId = item.placeId || sanitizeSlug(item.title) || `homestay-${index + 1}`;
  const currentCount = duplicateCounter.get(baseDocId) ?? 0;
  const nextCount = currentCount + 1;
  duplicateCounter.set(baseDocId, nextCount);

  if (nextCount === 1) {
    return baseDocId;
  }

  return `${baseDocId}-${nextCount}`;
}

async function commitChunk(db, chunk, chunkStartIndex, duplicateCounter) {
  const batch = writeBatch(db);

  for (let localIndex = 0; localIndex < chunk.length; localIndex += 1) {
    const item = chunk[localIndex];
    const globalIndex = chunkStartIndex + localIndex;
    const docId = buildUniqueDocId(item, globalIndex, duplicateCounter);

    const homestayDoc = buildHomestayDoc(item, docId);
    const homestayRef = doc(db, 'homestays', docId);
    batch.set(homestayRef, {
      ...homestayDoc,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();
}

async function main() {
  const inputArg = getArgValue('--input') || getArgValue('-i');
  const inputPath = inputArg
    ? path.resolve(projectRoot, inputArg)
    : path.join(projectRoot, 'scripts', 'data', 'homestays-import.json');

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
  const duplicateCounter = new Map();

  const chunkSize = 350;
  for (let index = 0; index < payload.length; index += chunkSize) {
    const chunk = payload.slice(index, index + chunkSize);
    await commitChunk(db, chunk, index, duplicateCounter);
    console.log(`Da import chunk ${Math.floor(index / chunkSize) + 1}, so ban ghi: ${chunk.length}`);
  }

  console.log(`Import hoan tat: ${payload.length} homestay.`);
  console.log('Da cap nhat collection "homestays".');
}

main().catch((error) => {
  console.error('Import that bai:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
