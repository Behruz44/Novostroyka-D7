async function main() {
  const csrf = await (await fetch('https://novostroyka-d7-production.up.railway.app/api/auth/csrf')).json();
  const body = new URLSearchParams({
    phone: '+998 50 123 45 67',
    password: 'Parking2026Owner!',
    csrfToken: csrf.csrfToken,
    redirect: 'false',
    json: 'true'
  });
  const r = await fetch('https://novostroyka-d7-production.up.railway.app/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    redirect: 'manual'
  });
  console.log('Login status:', r.status);
  const cookies = r.headers.get('set-cookie');
  if (!cookies) { console.log('No cookies'); return; }
  console.log('Full cookies:', cookies.substring(0, 600));

  // Try multiple token patterns
  const patterns = [
    /__Secure-next-auth\.session-token=([^;]+)/,
    /next-auth\.session-token=([^;]+)/,
  ];
  let token = null;
  let cookieName = '';
  for (const p of patterns) {
    const m = cookies.match(p);
    if (m) { token = m[1]; cookieName = p.source.split('=')[0].replace('\\.','.'); break; }
  }
  if (!token) { console.log('No session token found'); return; }
  console.log('Token found via:', cookieName);

  // Get stage marks
  const r2 = await fetch('https://novostroyka-d7-production.up.railway.app/api/stage-marks?projectId=cmrjjkcfw0003zy8d2kykh0wc', {
    headers: { Cookie: cookieName + '=' + token }
  });
  console.log('StageMarks status:', r2.status);
  const data = await r2.json();
  if (Array.isArray(data)) {
    data.slice(0, 3).forEach(m => console.log(JSON.stringify(m.photoKeys)));
  } else {
    console.log(JSON.stringify(data).substring(0, 500));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
