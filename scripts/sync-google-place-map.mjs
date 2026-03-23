#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const projectRoot = process.cwd();
const mapFilePath = path.join(projectRoot, 'src', 'app', 'data', 'google-place-id.map.ts');
const envFilePath = path.join(projectRoot, 'src', 'environments', 'environment.ts');
const DEFAULT_APP_PLACES = [
  { appId: 1, name: 'The Married Beans', address: 'Trần Phú, Đà Lạt', lat: 11.942, lng: 108.433 },
  { appId: 2, name: 'The Dalat House', address: 'Hồ Tuyền Lâm', lat: 11.908, lng: 108.456 },
  { appId: 3, name: 'Là Việt Coffee', address: 'Nguyễn Công Trứ', lat: 11.952, lng: 108.447 },
  { appId: 4, name: 'Pine Hill Homestay', address: 'Phường 4, Đà Lạt', lat: 11.918, lng: 108.43 },
  { appId: 5, name: 'Windmills Coffee', address: 'Hồ Tuyền Lâm', lat: 11.904, lng: 108.462 },
  { appId: 6, name: 'Valley View Villa', address: 'Cầu Đất', lat: 11.84, lng: 108.56 },
  { appId: 7, name: 'An Cafe', address: 'Phan Đình Phùng', lat: 11.947, lng: 108.441 },
  { appId: 8, name: 'Cozy Garden Stay', address: 'Phường 8', lat: 11.969, lng: 108.464 },
  { appId: 9, name: 'The Coffee House', address: 'Nguyễn Văn Cừ', lat: 11.956, lng: 108.451 },
  { appId: 10, name: 'The Wilder Nest Ta Nung', address: 'Tà Nung, Đà Lạt', lat: 11.921255, lng: 108.3365249 },
  { appId: 11, name: 'Cafe Dũng Bụi', address: '56 Đường Tôn Thất Tùng, Phường 8, Đà Lạt', lat: 11.9659555, lng: 108.4356739 },
  { appId: 12, name: 'S Coffee Roastery', address: '56 Đường Tôn Thất Tùng, Phường 8, Đà Lạt', lat: 11.9660072, lng: 108.4355842 },
  { appId: 13, name: 'Vườn Sen Coffee', address: '92 Đường Cao Bá Quát, Phường 7, Đà Lạt', lat: 11.9625341, lng: 108.431621 },
  { appId: 14, name: 'Tiệm cafe Người Thương Ơi', address: 'Phường 8, Đà Lạt', lat: 11.9714612, lng: 108.4366082 },
];

async function readEnvironmentSource() {
  try {
    return await fs.readFile(envFilePath, 'utf8');
  } catch {
    return '';
  }
}

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

function hasFlag(flag) {
  return process.argv.some((arg) => arg === flag);
}

async function getApiKey() {
  const fromArgs = getArgValue('--apiKey');
  if (fromArgs) {
    return fromArgs;
  }

  const fromEnv = process.env.GOOGLE_PLACES_API_KEY;
  if (fromEnv) {
    return fromEnv.trim();
  }

  const envFile = await readEnvironmentSource();
  const match = envFile.match(/googlePlacesApiKey:\s*'([^']+)'/);
  return match?.[1]?.trim() ?? '';
}

async function getDatabaseUrl() {
  const fromArgs = getArgValue('--databaseUrl');
  if (fromArgs) {
    return fromArgs;
  }

  const fromEnv = process.env.FIREBASE_DATABASE_URL;
  if (fromEnv) {
    return fromEnv.trim();
  }

  const envFile = await readEnvironmentSource();
  const match = envFile.match(/databaseURL:\s*'([^']+)'/);
  return match?.[1]?.trim() ?? '';
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

function parseNumber(value) {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

async function searchPlaces({ apiKey, name, address, lat, lng }) {
  const textQuery = `${name} ${address}`.trim();
  const body = {
    textQuery,
    languageCode: 'vi',
    regionCode: 'VN',
  };

  if (typeof lat === 'number' && typeof lng === 'number') {
    body.locationBias = {
      circle: {
        center: {
          latitude: lat,
          longitude: lng,
        },
        radius: 2500,
      },
    };
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.name,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google Places API error ${response.status}: ${message}`);
  }

  const data = await response.json();
  return data.places ?? [];
}

async function fetchGooglePlaceDetails(placeResourceName, apiKey) {
  const endpoint = `https://places.googleapis.com/v1/${placeResourceName}?languageCode=vi`;
  const response = await fetch(endpoint, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Khong lay duoc place details (${response.status}): ${message}`);
  }

  return await response.json();
}

async function writePlaceResourceToRealtimeDb({ databaseUrl, appId, resourceName }) {
  if (!databaseUrl) {
    return {
      ok: false,
      message: 'Khong tim thay databaseURL trong environment. Bo qua ghi Realtime Database.',
    };
  }

  const normalizedUrl = databaseUrl.replace(/\/$/, '');
  const endpoint = `${normalizedUrl}/shared/googlePlaceResourceByAppId/${appId}.json`;

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(resourceName),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      message: `Ghi Realtime Database that bai (${response.status}): ${errorText}`,
    };
  }

  return {
    ok: true,
    message: 'Da ghi place resource len Realtime Database.',
  };
}

async function writeGoogleReviewsToFirestore({ firebaseConfig, appId, placeResourceName, details }) {
  if (!firebaseConfig) {
    return {
      ok: false,
      message: 'Khong tim thay Firebase config hop le. Bo qua ghi Firestore reviews cache.',
    };
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const reviews = (details.reviews ?? []).map((review) => ({
    authorName: review.authorAttribution?.displayName ?? 'Nguoi dung Google',
    authorPhotoUri: review.authorAttribution?.photoUri ?? '',
    rating: typeof review.rating === 'number' ? review.rating : 5,
    publishTime: review.publishTime ?? '',
    relativePublishTimeDescription: review.relativePublishTimeDescription ?? '',
    text: review.text?.text ?? '',
  }));

  await setDoc(
    doc(db, 'shared_google_place_reviews', String(appId)),
    {
      appId,
      placeResourceName,
      rating: typeof details.rating === 'number' ? details.rating : 0,
      reviewCount: typeof details.userRatingCount === 'number' ? details.userRatingCount : reviews.length,
      reviews,
      syncedAtIso: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ok: true,
    message: `Da ghi reviews cache len Firestore (${reviews.length} review).`,
  };
}

function updateMapSource(sourceText, appId, resourceName) {
  const linePattern = new RegExp(`(^\\s*${appId}:\\s*)'[^']*'(,?)`, 'm');
  if (linePattern.test(sourceText)) {
    return sourceText.replace(linePattern, `$1'${resourceName}'$2`);
  }

  const closingIndex = sourceText.indexOf('};');
  if (closingIndex === -1) {
    throw new Error('Cannot find map object closing token in google-place-id.map.ts');
  }

  const insertion = `  ${appId}: '${resourceName}',\n`;
  return `${sourceText.slice(0, closingIndex)}${insertion}${sourceText.slice(closingIndex)}`;
}

async function persistResourceAndReviews({ apiKey, databaseUrl, firebaseConfig, appId, resourceName }) {
  const sourceText = await fs.readFile(mapFilePath, 'utf8');
  const updatedText = updateMapSource(sourceText, appId, resourceName);
  await fs.writeFile(mapFilePath, updatedText, 'utf8');

  const realtimeResult = await writePlaceResourceToRealtimeDb({
    databaseUrl,
    appId,
    resourceName,
  });

  let firestoreResult = {
    ok: false,
    message: 'Bo qua ghi Firestore reviews cache.',
  };

  try {
    const details = await fetchGooglePlaceDetails(resourceName, apiKey);
    firestoreResult = await writeGoogleReviewsToFirestore({
      firebaseConfig,
      appId,
      placeResourceName: resourceName,
      details,
    });
  } catch (error) {
    firestoreResult = {
      ok: false,
      message: `Khong dong bo duoc reviews len Firestore: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return {
    realtimeResult,
    firestoreResult,
  };
}

async function runAutoSyncAll({ apiKey, databaseUrl, firebaseConfig }) {
  const limitText = getArgValue('--limit');
  const limit = Number.parseInt(limitText, 10);
  const targets = Number.isFinite(limit) && limit > 0
    ? DEFAULT_APP_PLACES.slice(0, limit)
    : DEFAULT_APP_PLACES;

  console.log('=== Auto sync tat ca dia diem ===');
  console.log(`So dia diem se xu ly: ${targets.length}`);

  let successCount = 0;
  for (const target of targets) {
    console.log(`\n[appId ${target.appId}] ${target.name}`);

    try {
      const places = await searchPlaces({
        apiKey,
        name: target.name,
        address: target.address,
        lat: target.lat,
        lng: target.lng,
      });

      if (!places.length) {
        console.log('Khong tim thay ket qua nao tu Google Places.');
        continue;
      }

      const chosen = places[0];
      const resourceName = chosen?.name ?? '';
      if (!resourceName.startsWith('places/')) {
        console.log('Khong lay duoc resource hop le.');
        continue;
      }

      const { realtimeResult, firestoreResult } = await persistResourceAndReviews({
        apiKey,
        databaseUrl,
        firebaseConfig,
        appId: target.appId,
        resourceName,
      });

      console.log(`Da cap nhat appId ${target.appId} -> ${resourceName}`);
      console.log(realtimeResult.message);
      console.log(firestoreResult.message);
      successCount += 1;
    } catch (error) {
      console.log(error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`\nHoan tat auto sync: ${successCount}/${targets.length} thanh cong.`);
}

async function runSingleSyncFromArgs({ apiKey, databaseUrl, firebaseConfig }) {
  const appIdText = getArgValue('--appId');
  const name = getArgValue('--name');
  const address = getArgValue('--address');
  const latText = getArgValue('--lat');
  const lngText = getArgValue('--lng');
  const pickText = getArgValue('--pick');

  if (!appIdText || !name) {
    return false;
  }

  const appId = Number.parseInt(appIdText, 10);
  if (!Number.isFinite(appId)) {
    throw new Error('Gia tri --appId khong hop le.');
  }

  const lat = latText ? parseNumber(latText) : null;
  const lng = lngText ? parseNumber(lngText) : null;
  const pick = Number.parseInt(pickText || '1', 10);

  console.log('=== Single sync tu tham so CLI ===');
  console.log(`App ID : ${appId}`);
  console.log(`Name   : ${name}`);
  if (address) {
    console.log(`Address: ${address}`);
  }

  const places = await searchPlaces({
    apiKey,
    name,
    address,
    lat: typeof lat === 'number' ? lat : undefined,
    lng: typeof lng === 'number' ? lng : undefined,
  });

  if (!places.length) {
    throw new Error('Khong tim thay ket qua nao tu Google Places.');
  }

  console.log('Ket qua tim thay:');
  places.slice(0, 8).forEach((place, index) => {
    const resource = place.name ?? '';
    const displayName = place.displayName?.text ?? '(khong co ten)';
    const formattedAddress = place.formattedAddress ?? '(khong co dia chi)';
    console.log(`${index + 1}. ${displayName}`);
    console.log(`   Resource: ${resource}`);
    console.log(`   Address : ${formattedAddress}`);
  });

  const selectedIndex = Number.isFinite(pick) && pick >= 1 ? pick : 1;
  const chosen = places[selectedIndex - 1] ?? places[0];
  const resourceName = chosen?.name ?? '';
  if (!resourceName.startsWith('places/')) {
    throw new Error('Khong lay duoc resource hop le.');
  }

  const { realtimeResult, firestoreResult } = await persistResourceAndReviews({
    apiKey,
    databaseUrl,
    firebaseConfig,
    appId,
    resourceName,
  });

  console.log(`Da cap nhat appId ${appId} -> ${resourceName}`);
  console.log(realtimeResult.message);
  console.log(firestoreResult.message);
  return true;
}

async function main() {
  const apiKey = await getApiKey();
  const databaseUrl = await getDatabaseUrl();
  const firebaseConfig = await getFirebaseConfig();
  if (!apiKey) {
    console.error('Khong tim thay API key. Dung --apiKey=YOUR_KEY hoac set GOOGLE_PLACES_API_KEY.');
    process.exit(1);
  }

  if (hasFlag('--all')) {
    await runAutoSyncAll({ apiKey, databaseUrl, firebaseConfig });
    return;
  }

  const handledByArgs = await runSingleSyncFromArgs({ apiKey, databaseUrl, firebaseConfig });
  if (handledByArgs) {
    return;
  }

  const rl = createInterface({ input, output });

  console.log('=== Google Place Resource Mapper ===');
  console.log(`Map file: ${mapFilePath}`);
  console.log('Nhap appId de cap nhat. De trong appId de thoat.');

  try {
    while (true) {
      const appIdText = (await rl.question('\nApp ID: ')).trim();
      if (!appIdText) {
        break;
      }

      const appId = Number.parseInt(appIdText, 10);
      if (!Number.isFinite(appId)) {
        console.log('App ID khong hop le.');
        continue;
      }

      const name = (await rl.question('Ten dia diem: ')).trim();
      if (!name) {
        console.log('Ten dia diem la bat buoc.');
        continue;
      }

      const address = (await rl.question('Dia chi (co the bo trong): ')).trim();
      const latText = (await rl.question('Latitude (co the bo trong): ')).trim();
      const lngText = (await rl.question('Longitude (co the bo trong): ')).trim();

      const lat = latText ? parseNumber(latText) : null;
      const lng = lngText ? parseNumber(lngText) : null;

      try {
        const places = await searchPlaces({
          apiKey,
          name,
          address,
          lat: typeof lat === 'number' ? lat : undefined,
          lng: typeof lng === 'number' ? lng : undefined,
        });

        if (!places.length) {
          console.log('Khong tim thay ket qua nao tu Google Places.');
          continue;
        }

        console.log('\nKet qua tim thay:');
        places.slice(0, 8).forEach((place, index) => {
          const resource = place.name ?? '';
          const displayName = place.displayName?.text ?? '(khong co ten)';
          const formattedAddress = place.formattedAddress ?? '(khong co dia chi)';
          console.log(`${index + 1}. ${displayName}`);
          console.log(`   Resource: ${resource}`);
          console.log(`   Address : ${formattedAddress}`);
        });

        const selectionText = (await rl.question('Chon so thu tu ket qua de ghi vao map (Enter de bo qua): ')).trim();
        if (!selectionText) {
          console.log('Bo qua cap nhat cho appId nay.');
          continue;
        }

        const selection = Number.parseInt(selectionText, 10);
        if (!Number.isFinite(selection) || selection < 1 || selection > Math.min(8, places.length)) {
          console.log('Lua chon khong hop le.');
          continue;
        }

        const chosen = places[selection - 1];
        const resourceName = chosen?.name ?? '';
        if (!resourceName.startsWith('places/')) {
          console.log('Khong lay duoc resource hop le.');
          continue;
        }

        const { realtimeResult, firestoreResult } = await persistResourceAndReviews({
          apiKey,
          databaseUrl,
          firebaseConfig,
          appId,
          resourceName,
        });

        console.log(`Da cap nhat appId ${appId} -> ${resourceName}`);
        console.log(realtimeResult.message);
        console.log(firestoreResult.message);
      } catch (error) {
        console.log(error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    rl.close();
  }

  console.log('\nHoan tat.');
}

void main();
