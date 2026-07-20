/**
 * E2E test for stage dependencies feature.
 * Tests: PATCH dependency, cycle detection, self-dependency, cross-project, dependencyWarning.
 */
const BASE = "https://novostroyka-d7-production.up.railway.app";

const OWNER_PHONE = "+998501234567";
const OWNER_PASSWORD = "Parking2026Owner!";

const PROJECT1_ID = "cmrjjkcfw0003zy8d2kykh0wc";
const PROJECT2_ID = "cmrjjkcj4000wzy8duy1inpw6";

// Project1 stages
const DONE_STAGE_ID = "cmrjjkcig000hzy8dxomy2cvp";   // Stage A
const LATE_STAGE_ID = "cmrjjkcig000dzy8d9gsm0hp4";   // Stage B

// Project2 stage (foreign)
const FOREIGN_STAGE_ID = "cmrjjkck40016zy8dpcyav1cc";

async function getCsrf() {
  const r = await fetch(`${BASE}/api/auth/csrf`);
  const d = await r.json();
  return { token: d.csrfToken, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}

async function login(phone, password) {
  const { token, cookie } = await getCsrf();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams({
      phone,
      password,
      redirect: "false",
      json: "true",
      csrfToken: token,
      callbackUrl: `${BASE}/app/owner`,
    }),
    redirect: "manual",
  });
  const cookies = res.headers.getSetCookie();
  const sessionCookie = cookies.map((c) => c.split(";")[0].trim()).find((c) => c.includes("session-token"));
  if (!sessionCookie) {
    throw new Error(`login failed for ${phone}: status=${res.status}`);
  }
  return sessionCookie;
}

async function patchStage(stageId, body, cookie) {
  return fetch(`${BASE}/api/stages/${stageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

async function getSummary(projectId, cookie) {
  const res = await fetch(`${BASE}/api/projects/${projectId}/summary`, {
    headers: { Cookie: cookie },
  });
  return res.json();
}

async function main() {
  console.log("=== Stage Dependencies E2E Test ===\n");
  const cookie = await login(OWNER_PHONE, OWNER_PASSWORD);
  console.log("✅ Logged in as owner\n");

  // Test 1: Stage A (DONE) depends on Stage B (LATE) → PATCH should succeed
  console.log("--- Test 1: Set DONE stage depends on LATE stage ---");
  const r1 = await patchStage(DONE_STAGE_ID, { dependsOnStageId: LATE_STAGE_ID }, cookie);
  const j1 = await r1.json();
  console.log(`Status: ${r1.status}`);
  console.log(`Response: ${JSON.stringify(j1)}`);
  if (r1.status === 200 && j1.dependsOnStageId === LATE_STAGE_ID) {
    console.log("✅ PASS: dependency set successfully\n");
  } else {
    console.log("❌ FAIL\n");
  }

  // Test 2: Attempt cycle — LATE stage depends on DONE stage → 400 "Циклическая зависимость"
  console.log("--- Test 2: Cycle attempt (LATE depends on DONE) ---");
  const r2 = await patchStage(LATE_STAGE_ID, { dependsOnStageId: DONE_STAGE_ID }, cookie);
  const j2 = await r2.json();
  console.log(`Status: ${r2.status}`);
  console.log(`Response: ${JSON.stringify(j2)}`);
  if (r2.status === 400 && j2.error === "Циклическая зависимость этапов") {
    console.log("✅ PASS: cycle detected\n");
  } else {
    console.log("❌ FAIL\n");
  }

  // Test 3: Self-dependency → 400
  console.log("--- Test 3: Self-dependency attempt ---");
  const r3 = await patchStage(DONE_STAGE_ID, { dependsOnStageId: DONE_STAGE_ID }, cookie);
  const j3 = await r3.json();
  console.log(`Status: ${r3.status}`);
  console.log(`Response: ${JSON.stringify(j3)}`);
  if (r3.status === 400 && j3.error === "Этап не может зависеть сам от себя") {
    console.log("✅ PASS: self-dependency blocked\n");
  } else {
    console.log("❌ FAIL\n");
  }

  // Test 4: Cross-project dependency → 400
  console.log("--- Test 4: Cross-project dependency attempt ---");
  const r4 = await patchStage(DONE_STAGE_ID, { dependsOnStageId: FOREIGN_STAGE_ID }, cookie);
  const j4 = await r4.json();
  console.log(`Status: ${r4.status}`);
  console.log(`Response: ${JSON.stringify(j4)}`);
  if (r4.status === 400 && j4.error === "Этап-зависимость не принадлежит указанному проекту") {
    console.log("✅ PASS: cross-project blocked\n");
  } else {
    console.log("❌ FAIL\n");
  }

  // Test 5: dependencyWarning — DONE depends on LATE, LATE has plannedEnd in future, DONE has plannedStart earlier
  // First, set LATE stage's plannedEnd to a future date
  console.log("--- Test 5: dependencyWarning check ---");
  const futureEnd = "2026-12-31";
  const earlyStart = "2026-01-01";

  // Set LATE stage dates: plannedEnd in future
  const r5a = await patchStage(LATE_STAGE_ID, { plannedEnd: futureEnd }, cookie);
  console.log(`Set LATE plannedEnd=${futureEnd}: status=${r5a.status}`);

  // Set DONE stage depends on LATE, and plannedStart earlier than LATE's plannedEnd
  const r5b = await patchStage(DONE_STAGE_ID, {
    dependsOnStageId: LATE_STAGE_ID,
    plannedStart: earlyStart,
  }, cookie);
  console.log(`Set DONE dependsOn LATE, plannedStart=${earlyStart}: status=${r5b.status}`);

  // Wait a moment then fetch summary
  await new Promise((r) => setTimeout(r, 1000));
  const summary = await getSummary(PROJECT1_ID, cookie);
  const doneStageInSummary = summary.stages?.find((s) => s.id === DONE_STAGE_ID);
  console.log(`DONE stage in summary: ${JSON.stringify(doneStageInSummary)}`);
  if (doneStageInSummary && doneStageInSummary.dependencyWarning === true) {
    console.log(`✅ PASS: dependencyWarning=true, dependencyStageName=${doneStageInSummary.dependencyStageName}\n`);
  } else {
    console.log("❌ FAIL: dependencyWarning not set\n");
  }

  // Cleanup: remove dependency from DONE stage
  console.log("--- Cleanup: remove dependency ---");
  const rc = await patchStage(DONE_STAGE_ID, { dependsOnStageId: null }, cookie);
  console.log(`Cleanup status: ${rc.status}\n`);

  console.log("=== All tests complete ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
