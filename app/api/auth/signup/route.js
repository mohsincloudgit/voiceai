import { NextResponse } from 'next/server';
import { getUserByEmail, saveUser } from '@/lib/db';
import { hashPassword, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists. Please log in.' },
        { status: 400 }
      );
    }

    // New signups get the 'user' role with access strictly to the recent agent
    const newUser = {
      id: 'user_' + Date.now(),
      name: (name || '').trim() || 'Client User',
      email: email.toLowerCase().trim(),
      password: hashPassword(password),
      role: 'user',
      assignedAgents: ['agent_ai_automation_ghl'],
      createdAt: new Date().toISOString()
    };

    await saveUser(newUser);

    const token = createSessionToken(newUser);
    const safeUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      assignedAgents: newUser.assignedAgents
    };

    const response = NextResponse.json({
      success: true,
      user: safeUser,
      token
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return response;
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error: ' + err.message },
      { status: 500 }
    );
  }
}
