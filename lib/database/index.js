import * as firebaseProvider from './firebaseProvider.js';
import * as jsonProvider from './jsonProvider.js';
import * as awsProvider from './awsProvider.js';

let lastLoggedProvider = null;

export function getActiveProvider() {
  const requested = (process.env.DB_PROVIDER || 'firebase').toLowerCase();

  if (requested === 'firebase') {
    if (firebaseProvider.isConfigured()) {
      if (lastLoggedProvider !== 'firebase') {
        console.log('🚀 Database Provider: Cloud Firestore (Firebase) Active');
        lastLoggedProvider = 'firebase';
      }
      return { name: 'firebase', provider: firebaseProvider, isFallback: false };
    }
    if (lastLoggedProvider !== 'json_fallback_firebase') {
      console.log('ℹ️ Firebase requested but credentials not yet configured in .env. Using local JSON database as fallback.');
      lastLoggedProvider = 'json_fallback_firebase';
    }
    return { name: 'json', fallbackFrom: 'firebase', provider: jsonProvider, isFallback: true };
  }

  if (requested === 'aws') {
    if (awsProvider.isConfigured()) {
      if (lastLoggedProvider !== 'aws') {
        console.log('🚀 Database Provider: AWS DynamoDB Active');
        lastLoggedProvider = 'aws';
      }
      return { name: 'aws', provider: awsProvider, isFallback: false };
    }
    return { name: 'json', fallbackFrom: 'aws', provider: jsonProvider, isFallback: true };
  }

  if (lastLoggedProvider !== 'json') {
    console.log('🚀 Database Provider: Local JSON Files Active');
    lastLoggedProvider = 'json';
  }
  return { name: 'json', provider: jsonProvider, isFallback: false };
}

export function getDatabaseStatus() {
  const active = getActiveProvider();
  return {
    provider: active.name,
    requestedProvider: process.env.DB_PROVIDER || 'firebase',
    isFallback: active.isFallback || false,
    fallbackFrom: active.fallbackFrom || null,
    isFirebaseConfigured: firebaseProvider.isConfigured(),
    isAwsConfigured: awsProvider.isConfigured(),
  };
}
