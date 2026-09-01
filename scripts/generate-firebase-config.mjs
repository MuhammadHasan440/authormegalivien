import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

if (!fs.existsSync(envPath)) {
  console.error('Missing .env file. Copy .env.example to .env and fill in your Firebase keys.');
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const index = trimmed.indexOf('=');
  if (index === -1) continue;
  env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
}

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || ''
};

if (!config.apiKey || !config.projectId) {
  console.error('Firebase keys are missing from .env');
  process.exit(1);
}

const out = `export const firebaseConfig = ${JSON.stringify(config, null, 2)};\n`;
fs.writeFileSync(path.join(root, 'js', 'firebase-config.js'), out);
console.log('Wrote js/firebase-config.js from .env');
