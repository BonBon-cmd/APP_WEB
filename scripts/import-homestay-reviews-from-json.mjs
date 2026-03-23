#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

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

function toDocId(item) {
  return String(item?.placeId || sanitizeSlug(item?.title) || '').trim();
}

async function getFirebaseConfig() {
  const envSource = await fs.readFile(envFilePath, 'utf8');
  const firebaseBlockMatch = envSource.match(/firebase\s*:\s*\{([\s\S]*?)\}\s*as\s*FirebaseOptions/m);
  if (!firebaseBlockMatch) {
    throw new Error('Khong doc duoc Firebase config tu environment.ts');
  }

  const block = firebaseBlockMatch[1];
  const getValue = (key) => {
    const match = block.match(new RegExp(`${key}\\s*:\\s*'([^']*)'`));
    return match?.[1]?.trim() ?? '';
  };

  return {
    apiKey: process.env.FIREBASE_WEB_API_KEY?.trim() || getValue('apiKey'),
    projectId: process.env.FIREBASE_PROJECT_ID?.trim() || getValue('projectId'),
    appId: getValue('appId'),
  };
}

function mapReview(review) {
  const stars = Number(review?.stars);
  return {
    authorName: String(review?.name || 'Nguoi dung Google'),
    authorPhotoUri: String(review?.reviewerPhotoUrl || ''),
    rating: Number.isFinite(stars) ? Math.max(1, Math.min(5, Math.round(stars))) : 5,
    publishTime: String(review?.publishedAtDate || ''),
    relativePublishTimeDescription: String(review?.publishAt || ''),
    text: String(review?.text || review?.textTranslated || '').trim(),
  };
}

async function main() {
  const inputArg = getArgValue('--input') || getArgValue('-i');
  const inputPath = inputArg
    ? path.resolve(projectRoot, inputArg)
    : path.join(projectRoot, 'scripts', 'data', 'homestays-import.json');

  const config = await getFirebaseConfig();
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const db = getFirestore(app);

  const raw = await fs.readFile(inputPath, 'utf8');
  const items = JSON.parse(raw);

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Input JSON phai la mot array va khong duoc rong.');
  }

  let uploaded = 0;
  let withReviews = 0;
  let verified = 0;

  for (const item of items) {
    const docId = toDocId(item);
    if (!docId) {
      continue;
    }

    const sourceReviews = Array.isArray(item.reviews) ? item.reviews : [];
    const reviews = sourceReviews.slice(0, 100).map(mapReview);
    const rating = Number(item.totalScore);
    const reviewCount = Number(item.reviewsCount);

    await setDoc(
      doc(db, 'shared_google_place_reviews', docId),
      {
        appId: docId,
        placeResourceName: item.placeId ? `places/${item.placeId}` : '',
        rating: Number.isFinite(rating) ? rating : 0,
        reviewCount: Number.isFinite(reviewCount) ? reviewCount : reviews.length,
        reviews,
        syncedAtIso: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    uploaded += 1;
    if (reviews.length > 0) {
      withReviews += 1;
    }

    const check = await getDoc(doc(db, 'shared_google_place_reviews', docId));
    if (check.exists()) {
      verified += 1;
    }
  }

  console.log(JSON.stringify({
    jsonItems: items.length,
    uploadedDocs: uploaded,
    docsWithReviews: withReviews,
    verifiedDocs: verified,
  }, null, 2));
}

main().catch((error) => {
  console.error('Import review that bai:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
