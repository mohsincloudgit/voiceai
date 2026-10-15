import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

import { hashPassword } from '../auth.js';

export const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
export const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
export const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
export const USERS_FILE = path.join(DATA_DIR, 'users.json');

export const DEFAULT_USERS = [
  {
    id: 'user_superadmin',
    name: 'Muhammad Mohsin (Super Admin)',
    email: 'muhammadmohsinghl@gmail.com',
    password: hashPassword('admin123'),
    role: 'superadmin',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user_demo_admin',
    name: 'Demo Admin (Testing)',
    email: 'admin@voiceai.com',
    password: hashPassword('admin123'),
    role: 'demo_admin',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user_client',
    name: 'Client User (Viewer)',
    email: 'client@voiceai.com',
    password: hashPassword('client123'),
    role: 'user',
    assignedAgents: ['agent_ai_automation_ghl'],
    createdAt: new Date().toISOString()
  }
];

export function readJson(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

export function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

// --- Provider Interface Implementation ---

export async function isConfigured() {
  return true;
}

export async function getAgents() {
  return readJson(AGENTS_FILE, []);
}

export async function getAgentById(id) {
  const agents = readJson(AGENTS_FILE, []);
  return agents.find(a => a.id === id) || null;
}

export async function saveAgent(agentData) {
  const agents = readJson(AGENTS_FILE, []);
  if (!agentData.id) {
    agentData.id = 'agent_' + Date.now();
  }
  const index = agents.findIndex(a => a.id === agentData.id);
  if (index >= 0) {
    agents[index] = { ...agents[index], ...agentData };
  } else {
    agents.push(agentData);
  }
  writeJson(AGENTS_FILE, agents);
  return agentData;
}

export async function deleteAgent(id) {
  let agents = readJson(AGENTS_FILE, []);
  agents = agents.filter(a => a.id !== id);
  writeJson(AGENTS_FILE, agents);
  return true;
}

export async function getLeads() {
  return readJson(LEADS_FILE, []);
}

export async function getLeadById(id) {
  const leads = readJson(LEADS_FILE, []);
  return leads.find(l => l.id === id) || null;
}

export async function saveLead(leadData) {
  const leads = readJson(LEADS_FILE, []);
  if (!leadData.id) {
    leadData.id = 'lead_' + Date.now();
  }
  const index = leads.findIndex(l => l.id === leadData.id);
  if (index >= 0) {
    leads[index] = { ...leads[index], ...leadData };
  } else {
    leads.unshift(leadData);
  }
  writeJson(LEADS_FILE, leads);
  return leadData;
}

export async function deleteLead(id) {
  let leads = readJson(LEADS_FILE, []);
  leads = leads.filter(l => l.id !== id);
  writeJson(LEADS_FILE, leads);
  return true;
}

export async function getSettings() {
  return readJson(SETTINGS_FILE, {});
}

export async function saveSettings(settingsData) {
  const current = readJson(SETTINGS_FILE, {});
  const merged = { ...current, ...settingsData };
  writeJson(SETTINGS_FILE, merged);
  return merged;
}

// --- Users (Auth & RBAC) ---

export async function getUsers() {
  const users = readJson(USERS_FILE, DEFAULT_USERS);
  // Guarantee default users exist if empty
  if (!users || users.length === 0) {
    writeJson(USERS_FILE, DEFAULT_USERS);
    return DEFAULT_USERS;
  }
  return users;
}

export async function getUserById(id) {
  const users = await getUsers();
  return users.find(u => u.id === id) || null;
}

export async function getUserByEmail(email) {
  if (!email) return null;
  const users = await getUsers();
  const normalized = email.toLowerCase().trim();
  return users.find(u => (u.email || '').toLowerCase().trim() === normalized) || null;
}

export async function saveUser(userData) {
  const users = await getUsers();
  if (!userData.id) {
    userData.id = 'user_' + Date.now();
  }
  if (!userData.createdAt) {
    userData.createdAt = new Date().toISOString();
  }
  const index = users.findIndex(u => u.id === userData.id || (userData.email && u.email?.toLowerCase() === userData.email.toLowerCase()));
  if (index >= 0) {
    users[index] = { ...users[index], ...userData };
  } else {
    users.push(userData);
  }
  writeJson(USERS_FILE, users);
  return userData;
}

