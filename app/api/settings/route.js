import { NextResponse } from 'next/server';
import { SETTINGS_FILE, readJson, writeJson } from '@/lib/db';

export async function GET() {
  const settings = readJson(SETTINGS_FILE, {});
  const safeSettings = {
    ...settings,
    smtpPass: settings.smtpPass ? '••••••••' : '',
    geminiApiKey: settings.geminiApiKey ? `${settings.geminiApiKey.slice(0, 6)}...` : ''
  };
  return NextResponse.json({ success: true, settings: safeSettings });
}

export async function POST(request) {
  try {
    const currentSettings = readJson(SETTINGS_FILE, {});
    const newSettings = await request.json();

    if (newSettings.smtpPass === '••••••••') {
      newSettings.smtpPass = currentSettings.smtpPass;
    }
    if (newSettings.geminiApiKey && newSettings.geminiApiKey.includes('...')) {
      newSettings.geminiApiKey = currentSettings.geminiApiKey;
    }

    const merged = { ...currentSettings, ...newSettings };
    writeJson(SETTINGS_FILE, merged);

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
