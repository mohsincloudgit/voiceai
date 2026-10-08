/**
 * AWS Database Provider (Prepared for Future Migration)
 * 
 * When migrating from Firebase to AWS:
 * 1. Install AWS SDK:
 *    npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
 * 
 * 2. Configure AWS credentials in .env:
 *    DB_PROVIDER=aws
 *    AWS_REGION=us-east-1
 *    AWS_ACCESS_KEY_ID=your_key
 *    AWS_SECRET_ACCESS_KEY=your_secret
 *    DYNAMODB_AGENTS_TABLE=voiceai_agents
 *    DYNAMODB_LEADS_TABLE=voiceai_leads
 *    DYNAMODB_SETTINGS_TABLE=voiceai_settings
 * 
 * 3. All API routes and UI will continue working seamlessly because they call
 *    the standard db interface in @/lib/db!
 */

export function isConfigured() {
  return Boolean(
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

export async function getAgents() {
  throw new Error('AWS Provider is prepared for future migration. Please configure AWS DynamoDB client in lib/database/awsProvider.js.');
}

export async function getAgentById(id) {
  throw new Error('AWS Provider is prepared for future migration.');
}

export async function saveAgent(agentData) {
  throw new Error('AWS Provider is prepared for future migration.');
}

export async function deleteAgent(id) {
  throw new Error('AWS Provider is prepared for future migration.');
}

export async function getLeads() {
  throw new Error('AWS Provider is prepared for future migration.');
}

export async function getLeadById(id) {
  throw new Error('AWS Provider is prepared for future migration.');
}

export async function saveLead(leadData) {
  throw new Error('AWS Provider is prepared for future migration.');
}

export async function deleteLead(id) {
  throw new Error('AWS Provider is prepared for future migration.');
}

export async function getSettings() {
  throw new Error('AWS Provider is prepared for future migration.');
}

export async function saveSettings(settingsData) {
  throw new Error('AWS Provider is prepared for future migration.');
}
