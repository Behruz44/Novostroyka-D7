/**
 * Screenshot script for stage dependencies UI.
 * Sets up a dependency with date conflict, then screenshots the building silhouette
 * with the dependency select and warning icon visible.
 */
const { chromium } = require("playwright");

const BASE = "https://novostroyka-d7-production.up.railway.app";
const OWNER_PHONE = "+998501234567";
const OWNER_PASSWORD = "Parking2026Owner!";
const PROJECT1_ID = "cmrjjkcfw0003zy8d2kykh0wc";
const DONE_STAGE_ID = "cmrjjkcig000hzy8dxomy2cvp";
const LATE_STAGE_ID = "cmrjjkcig000dzy8d9gsm0hp4";

async function getCsrf() {
  const r = await fetch(`${BASE}/api/auth/csrf`);
  const d = await r.json();
  return { token: d.csrfToken, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}

async function loginAPI() {
  const { token, cookie } = await getCsrf();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams({
      phone: OWNER_PHONE,
      password: OWNER_PASSWORD,
      redirect: "false",
      json: "true",
      csrfToken: token,
      callbackUrl: `${BASE}/app/owner`,
    }),
    redirect: "manual",
  });
  const cookies = res.headers.getSetCookie();
  const sessionCookie = cookies.map((c) => c.split(";")[0].trim()).find((c) => c.includes("session-token"));
  if (!sessionCookie) throw new Error(`login failed: status=${res.status}`);
  return sessionCookie;
}

async function patchStage(stageId, body, cookie) {
  return fetch(`${BASE}/api/stages/${stageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

(async () => {
  console.log("Setting up dependency for screenshot...");
  const cookie = await loginAPI();

  await patchStage(LATE_STAGE_ID, { plannedEnd: "2026-12-31" }, cookie);
  await patchStage(DONE_STAGE_ID, {
    dependsOnStageId: LATE_STAGE_ID,
    plannedStart: "2026-01-01",
  }, cookie);

  console.log("Dependency set up. Taking screenshot...");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/app/owner/${PROJECT1_ID}`, { waitUntil: "domcontentloaded" });

  const loginUrl = page.url();
  if (loginUrl.includes("login")) {
    await page.fill("#phone", OWNER_PHONE);
    await page.fill("#password", OWNER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`**/app/owner/${PROJECT1_ID}`, { timeout: 15000 });
  }

  await page.waitForTimeout(4000);

  // Click on floor 1 text inside the SVG to open edit panel
  await page.locator('text=1 эт.').first().click({ force: true });
  await page.waitForTimeout(2000);

  // Scroll the edit panel into view — find the panel by its heading
  const panelHeading = page.locator('text=Плановые даты');
  if (await panelHeading.count() > 0) {
    await panelHeading.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }

  // Take full page screenshot with extra height to capture everything
  await page.screenshot({ path: "scripts/stage-deps-ui.png", fullPage: true });
  console.log("Screenshot saved to scripts/stage-deps-ui.png");

  // Also take a viewport-only screenshot scrolled to the panel
  await page.evaluate(() => {
    const panel = document.querySelector('[class*="rounded-[14px]"]');
    if (panel) panel.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "scripts/stage-deps-panel.png", fullPage: false });
  console.log("Panel screenshot saved to scripts/stage-deps-panel.png");

  await browser.close();

  await patchStage(DONE_STAGE_ID, { dependsOnStageId: null }, cookie);
  console.log("Cleanup done.");
})();
