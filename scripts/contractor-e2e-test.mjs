// Real end-to-end verification against the deployed production app.
// Run with: node scripts/contractor-e2e-test.mjs
import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes, randomUUID } from "crypto";

const BASE = "https://novostroyka-d7-production.up.railway.app";

const PROJECT1 = "cmrjjkcfw0003zy8d2kykh0wc"; // Паркинг 8 этажей
const PROJECT2 = "cmrjjkcj4000wzy8duy1inpw6"; // Sunrise Residence

const OWNER_PHONE = "+998501234567";
const OWNER_PASS = "Parking2026Owner!";
const FOREMAN_PHONE = "+998501234563";
const FOREMAN_PASS = "Parking2026Foreman!";

const DONE_STAGE_ID = "cmrjjkcig000hzy8dxomy2cvp"; // Перекрытие, floor 1, project1, plannedEnd 2026-12-31
const LATE_STAGE_ID = "cmrjjkcig000dzy8d9gsm0hp4"; // Рампа/съезды, floor 0, project1
const BUDGET_LINE_P1 = "cmrjjkchi0006zy8di549plir"; // Фундаментные работы, project1
const FOREIGN_STAGE_P2 = "cmrjjkck40016zy8dpcyav1cc"; // Благоустройство, project2

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function getCsrf() {
  const r = await fetch(BASE + "/api/auth/csrf");
  const d = await r.json();
  return { token: d.csrfToken, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}

async function login(phone, pass) {
  const { token, cookie } = await getCsrf();
  const r = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams({
      phone,
      password: pass,
      redirect: "false",
      json: "true",
      csrfToken: token,
      callbackUrl: BASE + "/app/owner",
    }),
    redirect: "manual",
  });
  const cookies = r.headers.getSetCookie();
  const sessionCookie = cookies.map((c) => c.split(";")[0].trim()).find((c) => c.includes("session-token"));
  if (!sessionCookie) {
    throw new Error(`login failed for ${phone}: status=${r.status}`);
  }
  return sessionCookie;
}

async function call(method, path, cookie, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

function section(title) {
  console.log("\n" + "=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

async function main() {
  section("SETUP: logging in as FOREMAN and OWNER");
  const foremanCookie = await login(FOREMAN_PHONE, FOREMAN_PASS);
  const ownerCookie = await login(OWNER_PHONE, OWNER_PASS);
  console.log("foreman logged in, owner logged in");

  // ---------------------------------------------------------------------
  section("TEST 1: FOREMAN -> POST /api/contractors -> expect raw 403");
  // ---------------------------------------------------------------------
  const t1 = await call("POST", "/api/contractors", foremanCookie, {
    projectId: PROJECT1,
    name: "Нелегальный подрядчик",
    specialty: "Тест",
  });
  console.log("RAW RESPONSE:", JSON.stringify(t1, null, 2));
  console.log("RESULT:", t1.status === 403 ? "PASS (403)" : `FAIL (got ${t1.status})`);

  // ---------------------------------------------------------------------
  section("TEST 2a: Cross-project contractorId in POST /api/expenses -> expect 400");
  // ---------------------------------------------------------------------
  const foreignContractor = await call("POST", "/api/contractors", ownerCookie, {
    projectId: PROJECT2,
    name: "Чужой Подрядчик (project2)",
    specialty: "Тест cross-project",
  });
  console.log("Created foreign contractor (project2):", JSON.stringify(foreignContractor.body, null, 2));
  const foreignContractorId = foreignContractor.body.id;

  const t2a = await call("POST", "/api/expenses", ownerCookie, {
    projectId: PROJECT1,
    budgetLineId: BUDGET_LINE_P1,
    contractorId: foreignContractorId,
    amountMinor: "1500.00",
    description: "CROSS-PROJECT ATTACK TEST — contractorId from project2",
    expenseDate: new Date().toISOString(),
    clientRequestId: randomUUID(),
  });
  console.log("RAW RESPONSE:", JSON.stringify(t2a, null, 2));
  console.log("RESULT:", t2a.status === 400 ? "PASS (400)" : `FAIL (got ${t2a.status})`);

  // ---------------------------------------------------------------------
  section("TEST 2b: Cross-project contractorId in PATCH /api/stages/[id] -> expect 400");
  // ---------------------------------------------------------------------
  const t2b = await call("PATCH", `/api/stages/${DONE_STAGE_ID}`, ownerCookie, {
    contractorId: foreignContractorId,
  });
  console.log("RAW RESPONSE:", JSON.stringify(t2b, null, 2));
  console.log("RESULT:", t2b.status === 400 ? "PASS (400)" : `FAIL (got ${t2b.status})`);

  // ---------------------------------------------------------------------
  section("TEST 3a: FOREMAN -> GET /api/stages/[id] on FOREIGN (project2) stage -> expect 403 (role gate)");
  // ---------------------------------------------------------------------
  const t3a = await call("GET", `/api/stages/${FOREIGN_STAGE_P2}`, foremanCookie);
  console.log("RAW RESPONSE:", JSON.stringify(t3a, null, 2));
  console.log("RESULT:", t3a.status === 403 ? "PASS (403)" : `FAIL (got ${t3a.status})`);

  // ---------------------------------------------------------------------
  section("TEST 3b: OWNER-of-project2-only -> GET /api/stages/[id] on project1 stage -> expect 403 (membership gate)");
  // ---------------------------------------------------------------------
  const tempPassword = "TempP2Owner2026!";
  const tempUser = await prisma.user.create({
    data: {
      phone: "+998500000999",
      name: "TEMP Owner Project2 Only",
      passwordHash: hashPassword(tempPassword),
      role: "OWNER",
    },
  });
  await prisma.projectMember.create({
    data: { projectId: PROJECT2, userId: tempUser.id, role: "OWNER" },
  });
  console.log("Created temp user (member of project2 only):", tempUser.id);

  const tempCookie = await login("+998500000999", tempPassword);
  const t3b = await call("GET", `/api/stages/${DONE_STAGE_ID}`, tempCookie); // DONE_STAGE_ID belongs to project1
  console.log("RAW RESPONSE:", JSON.stringify(t3b, null, 2));
  console.log("RESULT:", t3b.status === 403 ? "PASS (403)" : `FAIL (got ${t3b.status})`);

  // cleanup temp user
  await prisma.projectMember.deleteMany({ where: { userId: tempUser.id } });
  await prisma.user.delete({ where: { id: tempUser.id } });
  console.log("Temp user cleaned up");

  // ---------------------------------------------------------------------
  section("TEST 4: Real contractor-performance end-to-end");
  // ---------------------------------------------------------------------
  const contractor = await call("POST", "/api/contractors", ownerCookie, {
    projectId: PROJECT1,
    name: "ООО ТестСтрой E2E",
    specialty: "Бетонные работы",
    phone: "+998900000001",
  });
  console.log("Created real contractor:", JSON.stringify(contractor.body, null, 2));
  const contractorId = contractor.body.id;

  // Assign contractor to both stages
  const assignDone = await call("PATCH", `/api/stages/${DONE_STAGE_ID}`, ownerCookie, {
    contractorId,
  });
  console.log("Assigned to DONE_STAGE (before completion):", JSON.stringify(assignDone.body, null, 2));

  const assignLate = await call("PATCH", `/api/stages/${LATE_STAGE_ID}`, ownerCookie, {
    contractorId,
    plannedEnd: "2026-01-01",
  });
  console.log("Assigned to LATE_STAGE + set plannedEnd in the past:", JSON.stringify(assignLate.body, null, 2));

  // Complete DONE_STAGE via the real review workflow: presign -> upload -> mark -> approve
  const presign = await call("POST", "/api/uploads/presign", foremanCookie, {
    projectId: PROJECT1,
    filename: "e2e-test.jpg",
    contentType: "image/jpeg",
    contentLength: 10,
  });
  console.log("Presign response:", JSON.stringify(presign.body, null, 2));

  const dummyBytes = Buffer.from("E2ETESTIMG"); // 10 bytes, matches contentLength above
  const putRes = await fetch(presign.body.url, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: dummyBytes,
  });
  console.log("S3 PUT status:", putRes.status);

  const markRes = await call("POST", "/api/stage-marks", foremanCookie, {
    projectId: PROJECT1,
    stageId: DONE_STAGE_ID,
    photoKeys: [presign.body.key],
    comment: "E2E test mark",
    clientRequestId: randomUUID(),
  });
  console.log("Stage mark created:", JSON.stringify(markRes.body, null, 2));
  const markId = markRes.body.id;

  const approveRes = await call("POST", `/api/stage-marks/${markId}/review`, ownerCookie, {
    action: "approve",
  });
  console.log("Stage mark approved (stage -> DONE):", JSON.stringify(approveRes.body, null, 2));

  // Real expense linked to this contractor
  const expenseRes = await call("POST", "/api/expenses", ownerCookie, {
    projectId: PROJECT1,
    budgetLineId: BUDGET_LINE_P1,
    contractorId,
    amountMinor: "5000000.00",
    description: "E2E: оплата ООО ТестСтрой E2E",
    expenseDate: new Date().toISOString(),
    clientRequestId: randomUUID(),
  });
  console.log("Expense created:", JSON.stringify(expenseRes.body, null, 2));
  const expenseAmountMinor = expenseRes.body.amountMinor;

  // Call the contractor-performance endpoint
  const perf = await call("GET", `/api/projects/${PROJECT1}/contractor-performance`, ownerCookie);
  console.log("\nRAW contractor-performance RESPONSE:");
  console.log(JSON.stringify(perf.body, null, 2));

  const row = perf.body.contractors.find((c) => c.contractorId === contractorId);
  console.log("\nMANUAL VERIFICATION:");
  console.log("  expected assignedStages = 2, got:", row.assignedStages);
  console.log("  expected doneStages     = 1, got:", row.doneStages);
  console.log("  expected lateStages     = 1, got:", row.lateStages);
  console.log("  expected totalPaidMinor =", expenseAmountMinor, ", got:", row.totalPaidMinor);

  const pass =
    row.assignedStages === 2 &&
    row.doneStages === 1 &&
    row.lateStages === 1 &&
    row.totalPaidMinor === expenseAmountMinor;
  console.log("\nRESULT:", pass ? "PASS" : "FAIL");
}

main()
  .catch((err) => {
    console.error("TEST SCRIPT ERROR:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
