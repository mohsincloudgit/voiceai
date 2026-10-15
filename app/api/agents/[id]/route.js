import { NextResponse } from 'next/server';
import { getAgentById, deleteAgent } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const agent = await getAgentById(id);

    if (!agent) {
      return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, agent });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  try {
    const user = getUserFromRequest(request);
    const { id } = await context.params;

    // Block client users
    if (user && user.role === 'user') {
      return NextResponse.json(
        { success: false, error: 'Permission denied: Client accounts cannot delete agents' },
        { status: 403 }
      );
    }

    // Protect reference agent and owner agents from demo_admin deletion
    const protectedIds = ['agent_ai_automation_ghl', 'agent_digital_agency', 'agent_real_estate', 'agent_solar_energy', 'agent_1791463825030'];
    if (user && user.role !== 'superadmin' && protectedIds.includes(id)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: Core reference agents cannot be deleted' },
        { status: 403 }
      );
    }

    await deleteAgent(id);
    return NextResponse.json({ success: true, message: 'Agent deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

