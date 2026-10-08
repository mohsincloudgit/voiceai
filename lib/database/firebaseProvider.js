import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let firestoreDb = null;

export function isConfigured() {
  if (firestoreDb) return true;

  // 1. Service account file path
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath && fs.existsSync(path.resolve(/*turbopackIgnore: true*/ process.cwd(), serviceAccountPath))) {
    return true;
  }

  // 2. Direct JSON string
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return true;
    } catch {
      return false;
    }
  }

  // 3. Individual credentials
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return true;
  }

  // 4. Project ID alone (for GCP environments with Application Default Credentials)
  if (process.env.FIREBASE_PROJECT_ID) {
    return true;
  }

  return false;
}

export function getDb() {
  if (firestoreDb) return firestoreDb;

  const existingApps = getApps();
  let app;

  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath && fs.existsSync(path.resolve(/*turbopackIgnore: true*/ process.cwd(), serviceAccountPath))) {
      try {
        const fileContent = fs.readFileSync(path.resolve(/*turbopackIgnore: true*/ process.cwd(), serviceAccountPath), 'utf-8');
        const serviceAccount = JSON.parse(fileContent);
        app = initializeApp({ credential: cert(serviceAccount) });
      } catch (err) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_PATH JSON:', err.message);
      }
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        app = initializeApp({ credential: cert(serviceAccount) });
      } catch (err) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', err.message);
      }
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        app = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
          })
        });
      } catch (err) {
        console.error('Failed to initialize Firebase Admin with env credentials:', err.message);
      }
    } else if (process.env.FIREBASE_PROJECT_ID) {
      try {
        app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
      } catch (err) {
        console.error('Failed to initialize Firebase with PROJECT_ID:', err.message);
      }
    }
  }

  if (!app) {
    return null;
  }

  firestoreDb = getFirestore(app);
  return firestoreDb;
}

// --- Agents ---

export async function getAgents() {
  const db = getDb();
  if (!db) throw new Error('Firebase Firestore is not initialized');

  const snapshot = await db.collection('agents').get();
  if (snapshot.empty) return [];

  const agents = [];
  snapshot.forEach(doc => {
    agents.push({ id: doc.id, ...doc.data() });
  });
  return agents;
}

export async function getAgentById(id) {
  const db = getDb();
  if (!db) throw new Error('Firebase Firestore is not initialized');

  const doc = await db.collection('agents').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function saveAgent(agentData) {
  const db = getDb();
  if (!db) throw new Error('Firebase Firestore is not initialized');

  if (!agentData.id) {
    agentData.id = 'agent_' + Date.now();
  }

  const { id, ...dataToSave } = agentData;
  await db.collection('agents').doc(id).set(dataToSave, { merge: true });
  return { id, ...dataToSave };
}

export async function deleteAgent(id) {
  const db = getDb();
  if (!db) throw new Error('Firebase Firestore is not initialized');

  await db.collection('agents').doc(id).delete();
  return true;
}

// --- Leads ---

export async function getLeads() {
  const db = getDb();
  if (!db) throw new Error('Firebase Firestore is not initialized');

  const snapshot = await db.collection('leads').get();
  if (snapshot.empty) return [];

  const leads = [];
  snapshot.forEach(doc => {
    leads.push({ id: doc.id, ...doc.data() });
  });

  // Sort descending by createdAt in memory (reliable without requiring composite index)
  leads.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return leads;
}

export async function getLeadById(id) {
  const db = getDb();
  if (!db) throw new Error('Firebase Firestore is not initialized');

  const doc = await db.collection('leads').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function saveLead(leadData) {
  const db = getDb();
  if (!db) throw new Error('Firebase Firestore is not initialized');

  if (!leadData.id) {
    leadData.id = 'lead_' + Date.now();
  }
  if (!leadData.createdAt) {
    leadData.createdAt = new Date().toISOString();
  }

  const { id, ...dataToSave } = leadData;
  await db.collection('leads').doc(id).set(dataToSave, { merge: true });
  return { id, ...dataToSave };
}

export async function deleteLead(id) {
  const db = getDb();
  if (!db) throw new Error('Firebase Firestore is not initialized');

  await db.collection('leads').doc(id).delete();
  return true;
}

// --- Settings ---

export async function getSettings() {
  const db = getDb();
  if (!db) throw new Error('Firebase Firestore is not initialized');

  const doc = await db.collection('settings').doc('crm_settings').get();
  if (!doc.exists) return {};
  return doc.data();
}

export async function saveSettings(settingsData) {
  const db = getDb();
  if (!db) throw new Error('Firebase Firestore is not initialized');

  await db.collection('settings').doc('crm_settings').set(settingsData, { merge: true });
  return settingsData;
}
