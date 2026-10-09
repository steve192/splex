import { expect, test } from "@playwright/test";

// Signed-out entry points. No backend is running, so these must render from
// the bundle alone; a crash during module evaluation leaves #root empty.
const ROUTES = ["/app/", "/app/login"];

for (const route of ROUTES) {
  test(`renders ${route} without uncaught errors`, async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto(route);

    // Soft, so a blank page also reports the uncaught errors that caused it.
    await expect.soft(page.locator("#root")).toContainText(/\S/);
    expect(pageErrors.map((error) => error.stack ?? error.message)).toEqual([]);
  });
}
