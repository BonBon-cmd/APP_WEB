#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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

async function readFirebaseConfig(projectRoot) {
  const envFilePath = path.join(projectRoot, 'src', 'environments', 'environment.ts');
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
    authDomain: getValue('authDomain'),
    projectId: process.env.FIREBASE_PROJECT_ID?.trim() || getValue('projectId'),
    databaseURL: process.env.FIREBASE_DATABASE_URL?.trim() || getValue('databaseURL'),
    storageBucket: getValue('storageBucket'),
    messagingSenderId: getValue('messagingSenderId'),
    appId: getValue('appId'),
    measurementId: getValue('measurementId'),
  };
}

async function main() {
  const projectRoot = process.cwd();
  const inputArg = getArgValue('--input') || getArgValue('-i');
  const inputPath = inputArg
    ? path.resolve(projectRoot, inputArg)
    : path.join(projectRoot, 'scripts', 'data', 'cafes-import.sample.json');

  const config = await readFirebaseConfig(projectRoot);
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const db = getFirestore(app);

  const raw = await fs.readFile(inputPath, 'utf8');
  const items = JSON.parse(raw);

  let cafesOk = 0;
  let reviewCacheOk = 0;
  let rtdbMapOk = 0;

  for (const item of items) {
    const docId = item.placeId;
    const appIdOrDoc = KNOWN_APP_ID_BY_TITLE[item.title] || docId;

    const cafeDoc = await getDoc(doc(db, 'cafes', docId));
    if (cafeDoc.exists()) {
      cafesOk += 1;
    }

    const reviewDoc = await getDoc(doc(db, 'shared_google_place_reviews', String(appIdOrDoc)));
    if (reviewDoc.exists()) {
      reviewCacheOk += 1;
    }

    const endpoint = `${String(config.databaseURL).replace(/\/$/, '')}/shared/googlePlaceResourceByAppId/${encodeURIComponent(String(appIdOrDoc))}.json`;
    const response = await fetch(endpoint);
    const value = await response.json();
    if (typeof value === 'string' && value.length > 0) {
      rtdbMapOk += 1;
    }
  }

  const summary = {
    total: items.length,
    cafesOk,
    reviewCacheOk,
    rtdbMapOk,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('Verify that bai:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
