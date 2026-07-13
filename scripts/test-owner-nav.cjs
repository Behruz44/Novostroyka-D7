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
  const cookies = r.headers.getSetCookie();
  return cookies.map(c => c.split(";")[0].trim()).find(c => c.includes("session-token"));
}

async function getPage(path, cookie) {
  const res = await fetch(BASE + path, { headers: { Cookie: cookie }, redirect: "manual" });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 3000), fullLen: text.length };
}

async function main() {
  console.log("=== NAVIGATION + RBAC TESTS ===\n");

  const ownerCookie = await login("+996700000002", "changeme-owner");
  console.log("[setup] owner logged in");

  const foremanCookie = await login("+996700000003", "changeme-foreman");
  console.log("[setup] foreman logged in\n");

  const projectsRes = await fetch(BASE + "/api/projects", { headers: { Cookie: ownerCookie } });
  const projectsData = await projectsRes.json();
  const projects = projectsData.projects;
  const p1 = projects.find(p => p.name.includes("Паркинг"));
  const p2 = projects.find(p => p.name.includes("Sunrise"));
  console.log("[setup] project1: " + p1.id + " (" + p1.name + ")");
  console.log("[setup] project2: " + p2.id + " (" + p2.name + ")\n");

  // TEST 1: Owner dashboard project1
  console.log("--- TEST 1: Owner dashboard project1 ---");
  const t1 = await getPage("/app/owner/" + p1.id, ownerCookie);
  console.log("Status: " + t1.status + ", HTML length: " + t1.fullLen);
  console.log("Is client-rendered page: " + (t1.text.includes("__next") || t1.text.includes("_next")) + "\n");

  // TEST 2: Owner review project1
  console.log("--- TEST 2: Owner review project1 ---");
  const t2 = await getPage("/app/owner/" + p1.id + "/review", ownerCookie);
  console.log("Status: " + t2.status + ", HTML length: " + t2.fullLen);
  console.log("Is client-rendered page: " + (t2.text.includes("__next") || t2.text.includes("_next")) + "\n");

  // TEST 3: Owner expenses project1
  console.log("--- TEST 3: Owner expenses project1 ---");
  const t3 = await getPage("/app/owner/" + p1.id + "/expenses", ownerCookie);
  console.log("Status: " + t3.status + ", HTML length: " + t3.fullLen);
  console.log("Is client-rendered page: " + (t3.text.includes("__next") || t3.text.includes("_next")) + "\n");

  // TEST 4: Switch to project2 — dashboard
  console.log("--- TEST 4: Owner dashboard project2 ---");
  const t4 = await getPage("/app/owner/" + p2.id, ownerCookie);
  console.log("Status: " + t4.status + ", HTML length: " + t4.fullLen);
  console.log("URL contains project2 id: " + t4.text.includes(p2.id) + "\n");

  // TEST 5: Switch to project2 — review
  console.log("--- TEST 5: Owner review project2 ---");
  const t5 = await getPage("/app/owner/" + p2.id + "/review", ownerCookie);
  console.log("Status: " + t5.status + ", HTML length: " + t5.fullLen + "\n");

  // TEST 6: Switch to project2 — expenses
  console.log("--- TEST 6: Owner expenses project2 ---");
  const t6 = await getPage("/app/owner/" + p2.id + "/expenses", ownerCookie);
  console.log("Status: " + t6.status + ", HTML length: " + t6.fullLen + "\n");

  // TEST 7: RBAC — foreman on /app/owner/{id}
  console.log("--- TEST 7: RBAC — foreman on /app/owner/{id} ---");
  const t7 = await getPage("/app/owner/" + p1.id, foremanCookie);
  console.log("Status: " + t7.status + ", HTML length: " + t7.fullLen);
  console.log("Contains '403': " + t7.text.includes("403"));
  console.log("Contains 'Запрещено' or 'доступ': " + (t7.text.includes("Запрещено") || t7.text.includes("доступ")));
  // Check if it's the 403 page (rewritten by middleware)
  console.log("Is 403 page: " + (t7.text.includes("403") || t7.text.includes("Запрещено") || t7.text.includes("Недостаточно")));
  console.log("First 200 chars: " + t7.text.slice(0, 200) + "\n");

  // TEST 8: RBAC — foreman on /app/owner/{id}/review
  console.log("--- TEST 8: RBAC — foreman on /app/owner/{id}/review ---");
  const t8 = await getPage("/app/owner/" + p1.id + "/review", foremanCookie);
  console.log("Status: " + t8.status);
  console.log("Is 403 page: " + (t8.text.includes("403") || t8.text.includes("Запрещено") || t8.text.includes("Недостаточно")) + "\n");

  // TEST 9: RBAC — foreman on /app/owner/{id}/expenses
  console.log("--- TEST 9: RBAC — foreman on /app/owner/{id}/expenses ---");
  const t9 = await getPage("/app/owner/" + p1.id + "/expenses", foremanCookie);
  console.log("Status: " + t9.status);
  console.log("Is 403 page: " + (t9.text.includes("403") || t9.text.includes("Запрещено") || t9.text.includes("Недостаточно")) + "\n");

  // TEST 10: API — review queue for project1 vs project2
  console.log("--- TEST 10: API review-queue project1 vs project2 ---");
  const rq1 = await fetch(BASE + "/api/stage-marks/review-queue?projectId=" + p1.id, { headers: { Cookie: ownerCookie } });
  const rq1d = await rq1.json();
  const rq2 = await fetch(BASE + "/api/stage-marks/review-queue?projectId=" + p2.id, { headers: { Cookie: ownerCookie } });
  const rq2d = await rq2.json();
  console.log("project1 marks: " + (rq1d.marks ? rq1d.marks.length : "error: " + JSON.stringify(rq1d)));
  console.log("project2 marks: " + (rq2d.marks ? rq2d.marks.length : "error: " + JSON.stringify(rq2d)) + "\n");

  // TEST 11: API — expenses for project1 vs project2
  console.log("--- TEST 11: API expenses project1 vs project2 ---");
  const ex1 = await fetch(BASE + "/api/expenses?projectId=" + p1.id, { headers: { Cookie: ownerCookie } });
  const ex1d = await ex1.json();
  const ex2 = await fetch(BASE + "/api/expenses?projectId=" + p2.id, { headers: { Cookie: ownerCookie } });
  const ex2d = await ex2.json();
  console.log("project1 expenses: " + (ex1d.expenses ? ex1d.expenses.length : "error: " + JSON.stringify(ex1d)));
  console.log("project2 expenses: " + (ex2d.expenses ? ex2d.expenses.length : "error: " + JSON.stringify(ex2d)) + "\n");

  // TEST 12: API — budget-summary for project1 vs project2
  console.log("--- TEST 12: API budget-summary project1 vs project2 ---");
  const bs1 = await fetch(BASE + "/api/budget-summary?projectId=" + p1.id, { headers: { Cookie: ownerCookie } });
  const bs1d = await bs1.json();
  const bs2 = await fetch(BASE + "/api/budget-summary?projectId=" + p2.id, { headers: { Cookie: ownerCookie } });
  const bs2d = await bs2.json();
  console.log("project1 budget lines: " + (bs1d.budgetLines ? bs1d.budgetLines.length : "error: " + JSON.stringify(bs1d)));
  console.log("project2 budget lines: " + (bs2d.budgetLines ? bs2d.budgetLines.length : "error: " + JSON.stringify(bs2d)) + "\n");

  console.log("=== ALL TESTS DONE ===");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
