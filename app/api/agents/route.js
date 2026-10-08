import { NextResponse } from 'next/server';
import { getAgents, saveAgent } from '@/lib/db';

export async function GET() {
  try {
    const agents = await getAgents();
    return NextResponse.json({ success: true, agents });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const agentData = await request.json();
    const saved = await saveAgent(agentData);
    return NextResponse.json({ success: true, agent: saved });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
