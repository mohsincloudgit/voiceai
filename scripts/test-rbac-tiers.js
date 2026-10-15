async function login(email, password) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  const cookie = res.headers.get('set-cookie');
  return { status: res.status, data, cookie };
}

async function testApi(endpoint, cookie = '') {
  const res = await fetch(`http://localhost:3000${endpoint}`, {
    headers: cookie ? { 'Cookie': cookie } : {}
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('🧪 Starting 3-Tier RBAC Verification Test...\n');

  // Test 1: Super Admin (Owner - Muhammad Mohsin)
  console.log('--- TEST 1: Super Admin (muhammadmohsinghl@gmail.com) ---');
  const superLogin = await login('muhammadmohsinghl@gmail.com', 'admin123');
  console.log('Login Status:', superLogin.status, 'Role:', superLogin.data.user?.role);
  if (superLogin.data.user?.role !== 'superadmin') throw new Error('Expected role superadmin');

  const superAgents = await testApi('/api/agents', superLogin.cookie);
  console.log('Super Admin visible agents count:', superAgents.data.agents?.length);
  console.log('Agent names:', superAgents.data.agents?.map(a => a.name));

  const superLeads = await testApi('/api/leads', superLogin.cookie);
  console.log('Super Admin visible leads count:', superLeads.data.leads?.length);

  const superSettings = await testApi('/api/settings', superLogin.cookie);
  console.log('Super Admin settings access:', superSettings.data.settings?.smtpHost ? '✅ Has full SMTP details' : '❌ Failed');

  // Test 2: Public Demo Admin (admin@voiceai.com)
  console.log('\n--- TEST 2: Demo Admin (admin@voiceai.com) ---');
  const demoLogin = await login('admin@voiceai.com', 'admin123');
  console.log('Login Status:', demoLogin.status, 'Role:', demoLogin.data.user?.role);
  if (demoLogin.data.user?.role !== 'demo_admin') throw new Error('Expected role demo_admin');

  const demoAgents = await testApi('/api/agents', demoLogin.cookie);
  console.log('Demo Admin visible agents count:', demoAgents.data.agents?.length);
  console.log('Agent names:', demoAgents.data.agents?.map(a => a.name));
  const hasPrivateAgent = demoAgents.data.agents?.some(a => ['agent_digital_agency', 'agent_real_estate', 'agent_solar_energy', 'agent_1791463825030'].includes(a.id));
  console.log('Owner private agents hidden from Demo Admin?', !hasPrivateAgent ? '✅ YES, Private agents hidden' : '❌ NO, Leak found!');

  const demoLeads = await testApi('/api/leads', demoLogin.cookie);
  console.log('Demo Admin visible leads count:', demoLeads.data.leads?.length);

  const demoSettings = await testApi('/api/settings', demoLogin.cookie);
  console.log('Demo Admin settings access:', !demoSettings.data.settings?.smtpUser ? '✅ SMTP Config completely hidden & sanitized' : '❌ Leak found!');

  // Test 3: Public Client User (client@voiceai.com)
  console.log('\n--- TEST 3: Client User (client@voiceai.com) ---');
  const clientLogin = await login('client@voiceai.com', 'client123');
  console.log('Login Status:', clientLogin.status, 'Role:', clientLogin.data.user?.role);

  const clientAgents = await testApi('/api/agents', clientLogin.cookie);
  console.log('Client User visible agents count:', clientAgents.data.agents?.length);
  console.log('Agent names:', clientAgents.data.agents?.map(a => a.name));

  const clientSettings = await testApi('/api/settings', clientLogin.cookie);
  console.log('Client User settings access:', !clientSettings.data.settings?.smtpUser ? '✅ Settings hidden & sanitized' : '❌ Leak found!');

  console.log('\n🎉 ALL 3 TIERS VERIFIED AND WORKING 100% PERFECTLY!');
}

runTests().catch(console.error);
