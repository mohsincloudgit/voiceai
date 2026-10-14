import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getUserById } from '@/lib/db';

export async function GET(request) {
  try {
    const sessionUser = getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ success: false, user: null });
    }

    // Refresh from db if exists
    const dbUser = await getUserById(sessionUser.id);
    const userToReturn = dbUser ? {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role || 'user',
      assignedAgents: dbUser.assignedAgents || sessionUser.assignedAgents || ['agent_ai_automation_ghl']
    } : sessionUser;

    return NextResponse.json({
      success: true,
      user: userToReturn
    });
  } catch (err) {
    console.error('Auth check error:', err);
    return NextResponse.json({ success: false, user: null });
  }
}
