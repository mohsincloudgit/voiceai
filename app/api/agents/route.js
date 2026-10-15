import { NextResponse } from 'next/server';
import { getAgents, saveAgent } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

const OWNER_PRIVATE_AGENT_IDS = [
  'agent_digital_agency',
  'agent_real_estate',
  'agent_solar_energy',
  'agent_1791463825030'
];

export async function GET(request) {
  try {
    const allAgents = await getAgents();
    const user = getUserFromRequest(request);

    // 1. Super Admin: Sees ALL agents (private owner agents + recent + dynamic)
    if (user && user.role === 'superadmin') {
      return NextResponse.json({ success: true, agents: allAgents });
    }

    // 2. Demo Admin (Testing): Owner private agents are completely hidden.
    // Sees recent agent (agent_ai_automation_ghl) as reference + any newly created test agents.
    if (user && (user.role === 'demo_admin' || user.role === 'admin')) {
      const publicAgents = allAgents.filter(a => !OWNER_PRIVATE_AGENT_IDS.includes(a.id));
      return NextResponse.json({
        success: true,
        agents: publicAgents.length > 0 ? publicAgents : allAgents.filter(a => a.id === 'agent_ai_automation_ghl')
      });
    }

    // 3. Client User: View-only access strictly to the recent agent (Zayn)
    if (user && user.role === 'user') {
      const clientAgents = allAgents.filter(a => a.id === 'agent_ai_automation_ghl');
      return NextResponse.json({
        success: true,
        agents: clientAgents.length > 0 ? clientAgents : allAgents.slice(-1)
      });
    }

    // Default unauthenticated / public
    const fallback = allAgents.filter(a => !OWNER_PRIVATE_AGENT_IDS.includes(a.id));
    return NextResponse.json({
      success: true,
      agents: fallback.length > 0 ? fallback : allAgents.filter(a => a.id === 'agent_ai_automation_ghl')
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    // Block client users from creating or updating agents
    if (user && user.role === 'user') {
      return NextResponse.json(
        { success: false, error: 'Permission denied: Client accounts have view-only access' },
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

