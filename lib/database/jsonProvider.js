import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
export const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
export const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

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
