import { NextResponse } from 'next/server';
import { AGENTS_FILE, readJson, writeJson } from '@/lib/db';

export async function GET() {
  const agents = readJson(AGENTS_FILE, []);
  return NextResponse.json({ success: true, agents });
}

export async function POST(request) {
  try {
    const agents = readJson(AGENTS_FILE, []);
    const agentData = await request.json();

    if (!agentData.id) {
      agentData.id = 'agent_' + Date.now();
    }

    const existingIndex = agents.findIndex(a => a.id === agentData.id);
    if (existingIndex >= 0) {
      agents[existingIndex] = { ...agents[existingIndex], ...agentData };
    } else {
      agents.push(agentData);
    }

    writeJson(AGENTS_FILE, agents);
    return NextResponse.json({ success: true, agent: agentData });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
