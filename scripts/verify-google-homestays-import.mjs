#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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
    projectId: process.env.FIREBASE_PROJECT_ID?.trim() || getValue('projectId'),
    appId: getValue('appId'),
  };
}

async function main() {
  const projectRoot = process.cwd();
  const inputArg = getArgValue('--input') || getArgValue('-i');
  const inputPath = inputArg
    ? path.resolve(projectRoot, inputArg)
    : path.join(projectRoot, 'scripts', 'data', 'homestays-import.json');

  const config = await readFirebaseConfig(projectRoot);
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const db = getFirestore(app);

  const raw = await fs.readFile(inputPath, 'utf8');
  const items = JSON.parse(raw);

  let homestaysOk = 0;

  for (const item of items) {
    const docId = item.placeId;
    const homestayDoc = await getDoc(doc(db, 'homestays', docId));
    if (homestayDoc.exists()) {
      homestaysOk += 1;
    }
  }

  const summary = {
    total: items.length,
    homestaysOk,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('Verify that bai:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
