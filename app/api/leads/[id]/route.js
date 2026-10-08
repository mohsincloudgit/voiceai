import { NextResponse } from 'next/server';
import { LEADS_FILE, readJson, writeJson } from '@/lib/db';

export async function GET(request, context) {
  const { id } = await context.params;
  const leads = readJson(LEADS_FILE, []);
  const lead = leads.find(l => l.id === id);

  if (!lead) {
    return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, lead });
}

export async function PATCH(request, context) {
  const { id } = await context.params;
  const body = await request.json();
  const leads = readJson(LEADS_FILE, []);
  const leadIndex = leads.findIndex(l => l.id === id);

  if (leadIndex === -1) {
    return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
  }

  leads[leadIndex] = { ...leads[leadIndex], ...body };
  writeJson(LEADS_FILE, leads);

  return NextResponse.json({ success: true, lead: leads[leadIndex] });
}

export async function DELETE(request, context) {
  const { id } = await context.params;
  let leads = readJson(LEADS_FILE, []);
  leads = leads.filter(l => l.id !== id);
  writeJson(LEADS_FILE, leads);

  return NextResponse.json({ success: true, message: 'Lead deleted' });
}
