import { getActiveProvider, getDatabaseStatus } from './database/index.js';
import {
  readJson,
  writeJson,
  AGENTS_FILE,
  LEADS_FILE,
  SETTINGS_FILE
} from './database/jsonProvider.js';

// Re-export legacy files & helpers for backwards compatibility
export {
  readJson,
  writeJson,
  AGENTS_FILE,
  LEADS_FILE,
  SETTINGS_FILE,
  getDatabaseStatus
};

// --- Unified Database Access Methods ---

export async function getAgents() {
  const { provider } = getActiveProvider();
  return provider.getAgents();
}

export async function getAgentById(id) {
  const { provider } = getActiveProvider();
  return provider.getAgentById(id);
}

export async function saveAgent(agentData) {
  const { provider } = getActiveProvider();
  return provider.saveAgent(agentData);
}

export async function deleteAgent(id) {
  const { provider } = getActiveProvider();
  return provider.deleteAgent(id);
}

export async function getLeads() {
  const { provider } = getActiveProvider();
  return provider.getLeads();
}

export async function getLeadById(id) {
  const { provider } = getActiveProvider();
  return provider.getLeadById(id);
}

export async function saveLead(leadData) {
  const { provider } = getActiveProvider();
  return provider.saveLead(leadData);
}

export async function deleteLead(id) {
  const { provider } = getActiveProvider();
  return provider.deleteLead(id);
}

export async function getSettings() {
  const { provider } = getActiveProvider();
  return provider.getSettings();
}

export async function saveSettings(settingsData) {
  const { provider } = getActiveProvider();
  return provider.saveSettings(settingsData);
}
