import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { isConfigured, getDb } from '../lib/database/firebaseProvider.js';

async function migrate() {
  console.log('\n========================================');
  console.log('🚀 Voice Agent CRM: Firebase Firestore Migration');
  console.log('========================================\n');

  if (!isConfigured()) {
    console.error('❌ Firebase credentials are not configured in .env!\n');
    console.log('Please provide your Firebase credentials in .env using either:\n');
    console.log('--- Option A: Service Account JSON File (Recommended) ---');
    console.log('1. Go to Firebase Console -> Project Settings -> Service accounts');
    console.log('2. Click "Generate new private key"');
    console.log('3. Save the JSON file in your project (e.g. ./serviceAccountKey.json)');
    console.log('4. Add to .env: FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json\n');
    console.log('--- Option B: Environment Variables ---');
    console.log('FIREBASE_PROJECT_ID=your-project-id');
    console.log('FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com');
    console.log('FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"\n');
    process.exit(1);
  }

  let db;
  try {
    db = getDb();
    if (!db) throw new Error('Firestore instance could not be created');
  } catch (err) {
    console.error('❌ Failed to connect to Firebase Firestore:', err.message);
    process.exit(1);
  }

  const dataDir = path.resolve(process.cwd(), 'data');

  // 1. Migrate Agents
  const agentsFile = path.join(dataDir, 'agents.json');
  let agentsCount = 0;
  if (fs.existsSync(agentsFile)) {
    try {
      const agents = JSON.parse(fs.readFileSync(agentsFile, 'utf-8') || '[]');
      console.log(`⏳ Migrating ${agents.length} agents to collection "agents"...`);
      for (const agent of agents) {
        if (!agent.id) agent.id = 'agent_' + Date.now();
        const { id, ...data } = agent;
        await db.collection('agents').doc(id).set(data, { merge: true });
        agentsCount++;
      }
      console.log(`✅ ${agentsCount} agents migrated successfully.`);
    } catch (err) {
      console.error('❌ Error migrating agents:', err.message);
    }
  }

  // 2. Migrate Leads
  const leadsFile = path.join(dataDir, 'leads.json');
  let leadsCount = 0;
  if (fs.existsSync(leadsFile)) {
    try {
      const leads = JSON.parse(fs.readFileSync(leadsFile, 'utf-8') || '[]');
      console.log(`⏳ Migrating ${leads.length} leads to collection "leads"...`);
      for (const lead of leads) {
        if (!lead.id) lead.id = 'lead_' + Date.now();
        const { id, ...data } = lead;
        await db.collection('leads').doc(id).set(data, { merge: true });
        leadsCount++;
      }
      console.log(`✅ ${leadsCount} leads migrated successfully.`);
    } catch (err) {
      console.error('❌ Error migrating leads:', err.message);
    }
  }

  // 3. Migrate Settings
  const settingsFile = path.join(dataDir, 'settings.json');
  let settingsMigrated = false;
  if (fs.existsSync(settingsFile)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8') || '{}');
      console.log('⏳ Migrating CRM settings to collection "settings" (doc: "crm_settings")...');
      await db.collection('settings').doc('crm_settings').set(settings, { merge: true });
      settingsMigrated = true;
      console.log('✅ Settings migrated successfully.');
    } catch (err) {
      console.error('❌ Error migrating settings:', err.message);
    }
  }

  console.log('\n========================================');
  console.log('🎉 Firebase Firestore Migration Complete!');
  console.log(`   - Agents:   ${agentsCount}`);
  console.log(`   - Leads:    ${leadsCount}`);
  console.log(`   - Settings: ${settingsMigrated ? 'Migrated' : 'Skipped'}`);
  console.log('========================================\n');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
