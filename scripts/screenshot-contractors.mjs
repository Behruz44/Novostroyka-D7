import { chromium } from "playwright";

const BASE = "https://novostroyka-d7-production.up.railway.app";
const PROJECT1 = "cmrjjkcfw0003zy8d2kykh0wc";
const OWNER_PHONE = "+998501234567";
const OWNER_PASS = "Parking2026Owner!";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/login`);
  await page.fill('#phone', OWNER_PHONE);
  await page.fill('#password', OWNER_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app\/owner/, { timeout: 15000 });

  await page.goto(`${BASE}/app/owner/${PROJECT1}/contractors`);
  await page.waitForTimeout(2500);

  await page.screenshot({ path: "scripts/contractors-page.png", fullPage: true });
  console.log("Screenshot saved to scripts/contractors-page.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
