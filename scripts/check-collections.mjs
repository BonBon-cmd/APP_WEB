#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const root = process.cwd();

async function readFirebaseConfig() {
  const envFile = await fs.readFile(path.join(root, 'src/environments/environment.ts'), 'utf8');
  const m = envFile.match(/firebase\s*:\s*\{([\s\S]*?)\}\s*as\s*FirebaseOptions/m);
  if (!m) throw new Error('No firebase config');

  const b = m[1];
  const pick = (k) => (b.match(new RegExp(`${k}\\s*:\\s*'([^']*)'`))?.[1] || '').trim();

  return {
    apiKey: process.env.FIREBASE_WEB_API_KEY?.trim() || pick('apiKey'),
    projectId: process.env.FIREBASE_PROJECT_ID?.trim() || pick('projectId'),
    appId: pick('appId'),
  };
}

const config = await readFirebaseConfig();
const app = getApps().length ? getApps()[0] : initializeApp(config);
const db = getFirestore(app);

const homestaysSnap = await getDocs(collection(db, 'homestays'));
const cafesSnap = await getDocs(collection(db, 'cafes'));

console.log(JSON.stringify({
  homestays: homestaysSnap.size,
  cafes: cafesSnap.size,
}, null, 2));
