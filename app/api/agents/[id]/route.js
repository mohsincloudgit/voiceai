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
    if (user && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied: Only Admin can delete agents' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    await deleteAgent(id);
    return NextResponse.json({ success: true, message: 'Agent deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

