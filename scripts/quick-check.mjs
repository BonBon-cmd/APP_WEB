#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, limit, getDocs } from 'firebase/firestore';

const root = process.cwd();

async function checkData() {
  const envFile = await fs.readFile(path.join(root, 'src/environments/environment.ts'), 'utf8');
  const m = envFile.match(/firebase\s*:\s*\{([\s\S]*?)\}\s*as\s*FirebaseOptions/m);
  if (!m) throw new Error('No firebase config');

  const b = m[1];
  const pick = (k) => (b.match(new RegExp(`${k}\\s*:\\s*'([^']*)'`))?.[1] || '').trim();

  const config = {
    apiKey: process.env.FIREBASE_WEB_API_KEY?.trim() || pick('apiKey'),
    projectId: process.env.FIREBASE_PROJECT_ID?.trim() || pick('projectId'),
    appId: pick('appId'),
  };

  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const db = getFirestore(app);

  const homestaysSnap = await getDocs(query(collection(db, 'homestays'), limit(100)));
  const cafesSnap = await getDocs(query(collection(db, 'cafes'), limit(100)));

  const homestayNames = homestaysSnap.docs
    .slice(0, 3)
    .map(d => d.data().name)
    .join(', ');
  const cafeNames = cafesSnap.docs
    .slice(0, 3)
    .map(d => d.data().name)
    .join(', ');

  console.log(`Homestays: ${homestaysSnap.size} records (${homestayNames}...)`);
  console.log(`Cafes: ${cafesSnap.size} records (${cafeNames}...)`);
}

checkData().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
