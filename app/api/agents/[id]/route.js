import { NextResponse } from 'next/server';
import { AGENTS_FILE, readJson, writeJson } from '@/lib/db';

export async function GET(request, context) {
  const { id } = await context.params;
  const agents = readJson(AGENTS_FILE, []);
  const agent = agents.find(a => a.id === id);

  if (!agent) {
    return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, agent });
}

export async function DELETE(request, context) {
  const { id } = await context.params;
  let agents = readJson(AGENTS_FILE, []);
  agents = agents.filter(a => a.id !== id);
  writeJson(AGENTS_FILE, agents);

  return NextResponse.json({ success: true, message: 'Agent deleted' });
}
