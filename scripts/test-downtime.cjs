const BASE = "http://localhost:3000";

async function getCsrfToken() {
  const res = await fetch(`${BASE}/api/auth/csrf`);
  const data = await res.json();
  const cookie = res.headers.get("set-cookie");
  return { csrfToken: data.csrfToken, cookie: cookie?.split(";")[0] };
}

async function login(phone, password) {
  const { csrfToken, cookie: csrfCookie } = await getCsrfToken();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookie,
    },
    body: new URLSearchParams({
      phone,
      password,
      redirect: "false",
      json: "true",
      csrfToken,
      callbackUrl: `${BASE}/app/foreman`,
    }),
    redirect: "manual",
  });
  const setCookieHeader = res.headers.get("set-cookie");
  if (!setCookieHeader) throw new Error(`login failed for ${phone}: ${res.status}`);
  // Node 20+ supports getSetCookie() which returns array of individual cookies
  const cookies = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [setCookieHeader];
  const sessionCookie = cookies
    .map((c) => c.split(";")[0].trim())
    .find((c) => c.includes("session-token"));
  if (!sessionCookie) throw new Error(`no session token in response for ${phone}`);
  return sessionCookie;
}

async function postDowntime(cookie, body) {
  return fetch(`${BASE}/api/downtime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
}

async function getEvents(cookie, projectId) {
  const res = await fetch(`${BASE}/api/projects/${projectId}/events?limit=50`, {
    headers: { Cookie: cookie },
  });
  return res.json();
}

async function main() {
  console.log("=== DOWNTIME TESTS ===\n");

  const foremanCookie = await login("+996700000003", "changeme-foreman");
  console.log("[setup] foreman logged in");

  const ownerCookie = await login("+996700000002", "changeme-owner");
  console.log("[setup] owner logged in");

  // Get project IDs via owner
  const projectsRes = await fetch(`${BASE}/api/projects`, {
    headers: { Cookie: ownerCookie },
  });
  const projectsData = await projectsRes.json();
  console.log(`[debug] projects status: ${projectsRes.status}`);
  console.log(`[debug] projects response: ${JSON.stringify(projectsData).slice(0, 300)}`);

  if (projectsData.error) {
    console.error("FATAL: cannot fetch projects — auth issue");
    process.exit(1);
  }

  const projectsList = projectsData.projects || projectsData;
  // Foreman is member of "Паркинг" project only, not "Sunrise Residence"
  const project1 = projectsList.find((p) => p.name.includes("Паркинг"));
  const project2 = projectsList.find((p) => p.name.includes("Sunrise"));
  if (!project1 || !project2) {
    console.error("FATAL: could not find expected projects");
    process.exit(1);
  }
  console.log(`[setup] project1: ${project1.id} (${project1.name})`);
  console.log(`[setup] project2: ${project2.id} (${project2.name})\n`);

  // Get stages for foreman (returns all stages for foreman's projects)
  const stagesRes = await fetch(`${BASE}/api/stages`, {
    headers: { Cookie: foremanCookie },
  });
  const stagesData = await stagesRes.json();
  const stage1 = (stagesData.stages || []).find((s) => s.projectId === project1.id);
  console.log(`[setup] stage from project1: ${stage1?.id} (${stage1?.name})\n`);

  // --- TEST 1: 403 — foreman not member of project2 ---
  console.log("--- TEST 1: 403 (foreman not member of project2) ---");
  const t1 = await postDowntime(foremanCookie, {
    projectId: project2.id,
    stageId: null,
    reason: "WEATHER",
    comment: "test",
    clientRequestId: "test-403-" + Date.now(),
  });
  const t1body = await t1.json();
  console.log(`Status: ${t1.status}`);
  console.log(`Body: ${JSON.stringify(t1body)}\n`);

  // --- TEST 2: 400 — reason=OTHER without comment ---
  console.log("--- TEST 2: 400 (OTHER without comment) ---");
  const t2 = await postDowntime(foremanCookie, {
    projectId: project1.id,
    stageId: null,
    reason: "OTHER",
    comment: "",
    clientRequestId: "test-other-nocomment-" + Date.now(),
  });
  const t2body = await t2.json();
  console.log(`Status: ${t2.status}`);
  console.log(`Body: ${JSON.stringify(t2body)}\n`);

  // --- TEST 3: 400 — invalid reason ---
  console.log("--- TEST 3: 400 (invalid reason) ---");
  const t3 = await postDowntime(foremanCookie, {
    projectId: project1.id,
    stageId: null,
    reason: "какая-то дичь",
    comment: "test",
    clientRequestId: "test-bad-reason-" + Date.now(),
  });
  const t3body = await t3.json();
  console.log(`Status: ${t3.status}`);
  console.log(`Body: ${JSON.stringify(t3body)}\n`);

  // --- TEST 4: 400 — stageId from project1 but projectId=project2 ---
  console.log("--- TEST 4: 400 (stageId from project1, projectId=project2) ---");
  const t4 = await postDowntime(foremanCookie, {
    projectId: project2.id,
    stageId: stage1.id,
    reason: "WEATHER",
    comment: "test",
    clientRequestId: "test-cross-stage-" + Date.now(),
  });
  const t4body = await t4.json();
  console.log(`Status: ${t4.status}`);
  console.log(`Body: ${JSON.stringify(t4body)}\n`);

  // --- TEST 5: Create all 5 reason variants ---
  console.log("--- TEST 5: Create all 5 reason variants ---");
  const reasons = [
    { reason: "NO_MATERIALS", comment: null, expected: "Простой: нет материалов" },
    { reason: "WEATHER", comment: null, expected: "Простой: погода" },
    { reason: "AWAITING_OWNER_DECISION", comment: null, expected: "Простой: ждём решения владельца" },
    { reason: "AWAITING_INSPECTION", comment: null, expected: "Простой: ждём инспекцию" },
    { reason: "OTHER", comment: "Нет крана", expected: "Простой: Нет крана" },
  ];

  for (const r of reasons) {
    const crid = `test-${r.reason}-${Date.now()}`;
    const res = await postDowntime(foremanCookie, {
      projectId: project1.id,
      stageId: null,
      reason: r.reason,
      comment: r.comment,
      clientRequestId: crid,
    });
    const data = await res.json();
    console.log(`  ${r.reason}: status=${res.status}, id=${data.id}`);
  }

  // Check events feed
  console.log("\n--- Events feed for project1 ---");
  const events = await getEvents(ownerCookie, project1.id);
  const downtimeEvents = (events.events || []).filter((e) => e.action === "DOWNTIME_REPORTED");
  console.log(`Total DOWNTIME_REPORTED events: ${downtimeEvents.length}`);
  for (const e of downtimeEvents) {
    console.log(`  actionLabel: "${e.actionLabel}", userName: "${e.userName}"`);
  }

  // Verify all 5 labels
  console.log("\n--- Label verification ---");
  for (const r of reasons) {
    const found = downtimeEvents.find((e) => e.actionLabel === r.expected);
    console.log(`  ${r.reason}: expected="${r.expected}", found=${found ? "YES" : "NO"}`);
  }

  // --- TEST 6: Idempotency — same clientRequestId twice ---
  console.log("\n--- TEST 6: Idempotency (same clientRequestId) ---");
  const idempotentCrid = `test-idempotent-${Date.now()}`;
  const t6a = await postDowntime(foremanCookie, {
    projectId: project1.id,
    stageId: null,
    reason: "NO_MATERIALS",
    comment: null,
    clientRequestId: idempotentCrid,
  });
  const d6a = await t6a.json();
  console.log(`  First POST: status=${t6a.status}, id=${d6a.id}`);

  const t6b = await postDowntime(foremanCookie, {
    projectId: project1.id,
    stageId: null,
    reason: "NO_MATERIALS",
    comment: null,
    clientRequestId: idempotentCrid,
  });
  const d6b = await t6b.json();
  console.log(`  Second POST: status=${t6b.status}, id=${d6b.id}, alreadyProcessed=${d6b.alreadyProcessed}`);

  // Count downtime events with this clientRequestId
  const eventsAfter = await getEvents(ownerCookie, project1.id);
  const downtimeAfter = (eventsAfter.events || []).filter((e) => e.action === "DOWNTIME_REPORTED");
  console.log(`  Total DOWNTIME_REPORTED events after idempotency: ${downtimeAfter.length}`);
  console.log(`  Idempotency: ${d6a.id === d6b.id ? "PASS (same id)" : "FAIL (different ids)"}`);

  console.log("\n=== ALL TESTS DONE ===");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
