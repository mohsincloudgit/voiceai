import { NextResponse } from 'next/server';
import { getAgents, saveAgent } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const allAgents = await getAgents();
    const user = getUserFromRequest(request);

    // If logged in as non-admin user, restrict agents to assigned agents (e.g. recent agent)
    if (user && user.role !== 'admin') {
      const allowedIds = user.assignedAgents || ['agent_ai_automation_ghl'];
      const filtered = allAgents.filter(a => allowedIds.includes(a.id));
      // Fallback if none matched
      return NextResponse.json({
        success: true,
        agents: filtered.length > 0 ? filtered : allAgents.filter(a => a.id === 'agent_ai_automation_ghl')
      });
    }

    return NextResponse.json({ success: true, agents: allAgents });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    // Block non-admin users from creating or updating agents
    if (user && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied: Only Admin can create or edit agents' },
        { status: 403 }
      );
    }

    const agentData = await request.json();
    const saved = await saveAgent(agentData);
    return NextResponse.json({ success: true, agent: saved });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

