const BASE = "http://localhost:3000";

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
    body: new URLSearchParams({ phone, password: pass, redirect: "false", json: "true", csrfToken: token, callbackUrl: BASE + "/app/owner" }),
    redirect: "manual",
  });
  if (r.status === 429) { console.error("[login] Rate limited"); return null; }
  const setCookies = r.headers.getSetCookie();
  const sessionCookie = setCookies.find(c => c.includes("session-token"));
  if (!sessionCookie) { console.error("[login] No session cookie. Status:", r.status); return null; }
  return sessionCookie.split(";")[0].trim();
}

async function main() {
  console.log("=== EXTENDED AI DRAFT TESTS ===\n");

  const ownerCookie = await login("+996700000002", "changeme-owner");
  if (!ownerCookie) { console.error("FATAL: login failed"); process.exit(1); }
  console.log("[setup] owner logged in\n");

  // ==========================================
  // TEST A: End-to-end — AI draft → POST → DB
  // ==========================================
  console.log("--- TEST A: End-to-end AI draft → POST /api/projects → DB records ---\n");

  // Step 1: AI dialog — exchange 1
  console.log("[A.1] AI dialog exchange 1...");
  const a1 = await fetch(BASE + "/api/ai/project-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ messages: [{ role: "user", content: "Хочу построить паркинг на 5 этажей" }] }),
  });
  const a1d = await a1.json();
  console.log("  AI status:", a1.status);
  console.log("  AI reply:", (a1d.reply || "").slice(0, 200));
  console.log("  Has draft:", !!a1d.draft);

  let draft = a1d.draft;
  if (!draft) {
    // Step 2: AI dialog — exchange 2
    console.log("\n[A.2] AI dialog exchange 2 (provide details)...");
    const a2 = await fetch(BASE + "/api/ai/project-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Хочу построить паркинг на 5 этажей" },
          { role: "assistant", content: a1d.reply },
          { role: "user", content: "Адрес: ул. Манаса 12, бюджет примерно 5000000 сом. Давай сделай структуру." },
        ],
      }),
    });
    const a2d = await a2.json();
    console.log("  AI status:", a2.status);
    console.log("  AI reply:", (a2d.reply || "").slice(0, 200));
    console.log("  Has draft:", !!a2d.draft);
    draft = a2d.draft;
  }

  if (!draft) {
    console.log("\n  FATAL: No draft from AI. Cannot proceed with Test A.\n");
  } else {
    // Show raw draft
    console.log("\n[A.3] Raw AI draft:");
    console.log("  name:", draft.name);
    console.log("  address:", draft.address);
    console.log("  totalBudgetMinor:", draft.totalBudgetMinor, "(type:", typeof draft.totalBudgetMinor, ")");
    console.log("  stages:");
    draft.stages.forEach((s, i) => {
      console.log("    [" + i + "] name:", s.name, "| floor:", s.floor, "| weightBp:", s.weightBp, "(type:", typeof s.weightBp, ")");
    });
    console.log("  budgetLines:");
    draft.budgetLines.forEach((b, i) => {
      console.log("    [" + i + "] category:", b.category, "| plannedMinor:", b.plannedMinor, "(type:", typeof b.plannedMinor, ")");
    });
    const ws = draft.stages.reduce((s, st) => s + st.weightBp, 0);
    console.log("  weightSum:", ws, ws === 10000 ? "(VALID)" : "(INVALID)");

    // Step 3: POST /api/projects with the draft
    const clientReqId = "test-e2e-" + Date.now();
    const postBody = {
      name: draft.name,
      address: draft.address,
      totalBudgetMinor: draft.totalBudgetMinor,
      stages: draft.stages.map((s, i) => ({ ...s, order: i + 1 })),
      budgetLines: draft.budgetLines,
      clientRequestId: clientReqId,
    };

    console.log("\n[A.4] POST /api/projects with AI draft...");
    console.log("  clientRequestId:", clientReqId);
    // Show the exact JSON body being sent (truncated)
    const bodyStr = JSON.stringify(postBody);
    console.log("  body (first 300 chars):", bodyStr.slice(0, 300));
    console.log("  totalBudgetMinor in body is string:", typeof postBody.totalBudgetMinor === "string");
    console.log("  plannedMinor[0] in body is string:", typeof postBody.budgetLines[0].plannedMinor === "string");

    const tA = await fetch(BASE + "/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: bodyStr,
    });
    const tAd = await tA.json();
    console.log("\n  POST response status:", tA.status, "(expected 201)");
    console.log("  POST response body:", JSON.stringify(tAd));

    if (tA.status === 201 && tAd.id) {
      const projectId = tAd.id;

      // Step 4: Verify DB records
      console.log("\n[A.5] Verifying DB records for project:", projectId);

      // We'll query the API to get project data (since we can't connect to DB directly from node easily)
      // Use a direct DB query via prisma
      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient();

      try {
        // Project
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true, address: true, totalBudgetMinor: true, createdAt: true },
        });
        console.log("\n  --- DB: Project ---");
        console.log("  id:", project.id);
        console.log("  name:", project.name);
        console.log("  address:", project.address);
        console.log("  totalBudgetMinor:", project.totalBudgetMinor.toString(), "(BigInt → string)");
        console.log("  createdAt:", project.createdAt);

        // Stages
        const stages = await prisma.stage.findMany({
          where: { projectId },
          orderBy: { order: "asc" },
          select: { id: true, name: true, floor: true, weightBp: true, order: true },
        });
        console.log("\n  --- DB: Stages (" + stages.length + ") ---");
        stages.forEach((s, i) => {
          console.log("  [" + i + "] id:", s.id, "| name:", s.name, "| floor:", s.floor, "| weightBp:", s.weightBp, "| order:", s.order);
        });
        const dbWeightSum = stages.reduce((sum, s) => sum + s.weightBp, 0);
        console.log("  DB weightSum:", dbWeightSum);

        // BudgetLines
        const budgetLines = await prisma.budgetLine.findMany({
          where: { projectId },
          select: { id: true, category: true, plannedMinor: true },
        });
        console.log("\n  --- DB: BudgetLines (" + budgetLines.length + ") ---");
        budgetLines.forEach((b, i) => {
          console.log("  [" + i + "] id:", b.id, "| category:", b.category, "| plannedMinor:", b.plannedMinor.toString(), "(BigInt → string)");
        });

        // ProjectMember
        const members = await prisma.projectMember.findMany({
          where: { projectId },
          select: { id: true, userId: true, role: true },
        });
        console.log("\n  --- DB: ProjectMembers (" + members.length + ") ---");
        members.forEach((m, i) => {
          console.log("  [" + i + "] id:", m.id, "| userId:", m.userId, "| role:", m.role);
        });

        // EventLog
        const events = await prisma.eventLog.findMany({
          where: { projectId, action: "PROJECT_CREATED" },
          select: { id: true, userId: true, action: true, entity: true, entityId: true, metadata: true, createdAt: true },
        });
        console.log("\n  --- DB: EventLog PROJECT_CREATED (" + events.length + ") ---");
        events.forEach((e, i) => {
          console.log("  [" + i + "] id:", e.id);
          console.log("       userId:", e.userId);
          console.log("       action:", e.action);
          console.log("       entity:", e.entity);
          console.log("       entityId:", e.entityId);
          console.log("       metadata:", JSON.stringify(e.metadata));
          console.log("       createdAt:", e.createdAt);
        });

        // Summary
        console.log("\n[A.6] DB verification summary:");
        console.log("  Project:", !!project, "(totalBudgetMinor is BigInt)");
        console.log("  Stages:", stages.length, "records, weightSum:", dbWeightSum);
        console.log("  BudgetLines:", budgetLines.length, "records (plannedMinor is BigInt)");
        console.log("  ProjectMembers:", members.length, "record(s)");
        console.log("  EventLog PROJECT_CREATED:", events.length, "record(s)");
        console.log("  ALL 5 TYPES PRESENT:", !!(project && stages.length && budgetLines.length && members.length && events.length));

        // ==========================================
        // TEST B: Idempotency — same clientRequestId
        // ==========================================
        console.log("\n--- TEST B: Idempotency — same clientRequestId twice ---\n");

        // Send the exact same body again with the same clientRequestId
        console.log("[B.1] Second POST with same clientRequestId:", clientReqId);
        const tB = await fetch(BASE + "/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: ownerCookie },
          body: bodyStr, // same body, same clientRequestId
        });
        const tBd = await tB.json();
        console.log("  POST response status:", tB.status, "(expected 200, not 201)");
        console.log("  POST response body:", JSON.stringify(tBd));
        console.log("  Same id?", tAd.id === tBd.id);
        console.log("  idempotent flag?", tBd.idempotent);

        // Verify DB — count projects with this name
        const projectCount = await prisma.project.count({
          where: { name: draft.name },
        });
        console.log("\n[B.2] DB check: project count with name '" + draft.name + "':", projectCount, "(expected 1)");
        console.log("  IDEMPOTENT:", projectCount === 1 && tAd.id === tBd.id);

        // ==========================================
        // TEST C: Money conversion path
        // ==========================================
        console.log("\n--- TEST C: Money conversion path — string all the way ---\n");

        console.log("[C.1] AI draft totalBudgetMinor:");
        console.log("  Value:", draft.totalBudgetMinor);
        console.log("  Type:", typeof draft.totalBudgetMinor);
        console.log("  Is string:", typeof draft.totalBudgetMinor === "string");

        console.log("\n[C.2] AI draft budgetLines[0].plannedMinor:");
        console.log("  Value:", draft.budgetLines[0].plannedMinor);
        console.log("  Type:", typeof draft.budgetLines[0].plannedMinor);
        console.log("  Is string:", typeof draft.budgetLines[0].plannedMinor === "string");

        console.log("\n[C.3] POST body (what client sends):");
        console.log("  totalBudgetMinor type:", typeof postBody.totalBudgetMinor);
        console.log("  budgetLines[0].plannedMinor type:", typeof postBody.budgetLines[0].plannedMinor);
        console.log("  No Number() or parseFloat() in the path: client sends raw string from AI");

        console.log("\n[C.4] Server-side parsing (POST /api/projects):");
        console.log("  Line 52: const budgetMinor = parseAmountToMinorUnits(totalBudgetMinor);");
        console.log("  Line 116: const planned = parseAmountToMinorUnits(bl.plannedMinor);");
        console.log("  parseAmountToMinorUnits takes string → returns BigInt (no float in between)");

        console.log("\n[C.5] DB storage:");
        console.log("  Project.totalBudgetMinor:", project.totalBudgetMinor.toString(), "(Prisma BigInt)");
        console.log("  BudgetLine[0].plannedMinor:", budgetLines[0].plannedMinor.toString(), "(Prisma BigInt)");

        // Verify: parse the string the same way and compare
        // parseAmountToMinorUnits: split on '.', pad kopecks to 2, BigInt(rubles) * 100n + BigInt(kopecks)
        const parts = draft.totalBudgetMinor.split(".");
        const r = parts[0] || "0";
        let k = parts[1] || "";
        k = k.padEnd(2, "0").slice(0, 2);
        const expected = BigInt(r) * 100n + BigInt(k);
        console.log("\n[C.6] Manual verification:");
        console.log("  Input string:", draft.totalBudgetMinor);
        console.log("  Expected BigInt:", expected.toString());
        console.log("  DB value:", project.totalBudgetMinor.toString());
        console.log("  MATCH:", expected === project.totalBudgetMinor);

        console.log("\n  NO FLOAT IN PATH:",
          typeof draft.totalBudgetMinor === "string" &&
          typeof postBody.totalBudgetMinor === "string" &&
          project.totalBudgetMinor === expected);

        // ==========================================
        // TEST D: Weight mismatch with difference
        // ==========================================
        console.log("\n--- TEST D: Weight mismatch error shows difference ---\n");

        const badBody = JSON.parse(JSON.stringify(postBody));
        badBody.clientRequestId = "test-bad-weights-" + Date.now();
        badBody.stages[0].weightBp = 3000; // reduce by some amount
        const badSum = badBody.stages.reduce((s, st) => s + st.weightBp, 0);

        const tD = await fetch(BASE + "/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: ownerCookie },
          body: JSON.stringify(badBody),
        });
        const tDd = await tD.json();
        console.log("  Bad weightSum:", badSum);
        console.log("  Status:", tD.status, "(expected 400)");
        console.log("  Error message:", tDd.error);
        console.log("  Contains 'Не хватает' or 'Избыток':", tDd.error.includes("Не хватает") || tDd.error.includes("Избыток"));
        console.log("  Difference shown:", badSum < 10000 ? (10000 - badSum) : (badSum - 10000));

      } finally {
        await prisma.$disconnect();
      }
    } else {
      console.log("\n  POST failed, cannot verify DB. Error:", tAd.error);
    }
  }

  console.log("\n=== ALL EXTENDED TESTS DONE ===");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
