import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:5173";

test("student marketplace demo renders the capability graph", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator("#project-name")).toBeVisible();
  await expect(page.getByText("Capability topology")).toBeVisible();
  await page.getByRole("button", { name: "Build Plan" }).click();
  await expect(page.getByText("Foundation")).toBeVisible();
});

test("approved module registry tab lists all modules", async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Module Registry" }).click();
  await expect(page.locator("#module-registry h2")).toBeVisible();
  // At least one registry card should be visible.
  await expect(page.locator(".registry-card").first()).toBeVisible();
  // Authenticated modules should show the local-auth entry.
  await expect(page.locator("#reg-local-auth")).toBeVisible();
  await expect(page.locator("#reg-sqlite-adapter")).toBeVisible();
});

test("compose marketplace button calls /api/compose and shows result notice", async ({ page }) => {
  await page.goto(BASE);
  // Wait for the page to load the demo.
  await expect(page.locator("#project-name")).toBeVisible();
  // Click compose.
  await page.locator("#btn-compose").click();
  // Toast notice should appear confirming composition.
  await expect(page.locator("#toast-notice")).toBeVisible({ timeout: 15000 });
  const noticeText = await page.locator("#toast-notice").textContent();
  expect(noticeText).toContain("module");
});

test("registry shows SELECTED badge for capabilities used in the demo plan", async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Module Registry" }).click();
  // The student marketplace uses authentication — so its badge should be marked.
  await expect(page.locator("#reg-local-auth .reg-active")).toBeVisible();
});

test("build ledger tab shows provenance entries", async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Build Ledger" }).click();
  await expect(page.getByText("Artifact provenance")).toBeVisible();
  await expect(page.locator("#artifact-ledger article").first()).toBeVisible();
});

test("adapter scanner tab scans local repository and displays capability coverage", async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Adapter Scanner" }).click();
  await expect(page.locator("#adapter-scanner")).toBeVisible();
  await expect(page.locator("#adapter-scanner h2")).toBeVisible();

  // Trigger scan
  const scanBtn = page.locator("#btn-run-scan");
  await expect(scanBtn).toBeVisible();
  await scanBtn.click();

  // Expect summary bar to show scanned files and adapters
  await expect(page.locator("#stat-scanned-files")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".adapter-card").first()).toBeVisible();
});

