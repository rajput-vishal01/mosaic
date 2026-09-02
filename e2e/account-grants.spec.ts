import { expect, test, type Page } from "@playwright/test";

const superadminEmail = process.env.E2E_SUPERADMIN_EMAIL ?? "admin@mosaic.local";
const superadminPassword = process.env.E2E_SUPERADMIN_PASSWORD ?? "MosaicLocalAdmin!2026";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("isolates agency account availability and client grants", async ({ browser, page }) => {
  test.setTimeout(90_000);
  const nonce = Date.now().toString();
  const agencyName = `Grant Agency ${nonce}`;
  const adminEmail = `grant-admin-${nonce}@mosaic.local`;
  const clientEmail = `grant-client-${nonce}@mosaic.local`;
  const secondClientEmail = `grant-client-two-${nonce}@mosaic.local`;
  const adminPassword = `MosaicGrantAdmin!${nonce}`;
  const clientPassword = `MosaicGrantClient!${nonce}`;
  const secondClientPassword = `MosaicGrantClientTwo!${nonce}`;
  const accountName = "Northstar Web Analytics";
  const secondAccountName = "Harbor Web Analytics";

  await signIn(page, superadminEmail, superadminPassword);
  await page.getByRole("link", { name: "Manage agencies" }).click();
  await page.getByLabel("Agency name").fill(agencyName);
  await page.getByLabel("URL slug").fill(`grant-agency-${nonce}`);
  await page.getByRole("button", { name: "Create agency" }).click();
  await page.getByRole("link", { name: agencyName }).click();
  await expect(page).toHaveURL(/\/dashboard\/agencies\/[^/]+$/);
  const agencyUrl = page.url();

  await page.getByText("Create credentials directly").click();
  const credentials = page.locator("details").filter({ hasText: "Create credentials directly" });
  await credentials.getByLabel("Full name").fill("Grant Agency Admin");
  await credentials.getByLabel("Email").fill(adminEmail);
  await credentials.getByLabel("Temporary password").fill(adminPassword);
  await credentials.getByLabel("Agency role").selectOption("admin");
  await credentials.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText(adminEmail)).toBeVisible();
  await credentials.getByLabel("Full name").fill("Grant Client");
  await credentials.getByLabel("Email").fill(clientEmail);
  await credentials.getByLabel("Temporary password").fill(clientPassword);
  await credentials.getByLabel("Agency role").selectOption("member");
  await credentials.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText(clientEmail)).toBeVisible();
  await credentials.getByLabel("Full name").fill("Second Grant Client");
  await credentials.getByLabel("Email").fill(secondClientEmail);
  await credentials.getByLabel("Temporary password").fill(secondClientPassword);
  await credentials.getByLabel("Agency role").selectOption("member");
  await credentials.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText(secondClientEmail)).toBeVisible();

  await page.getByRole("link", { name: "Manage account access" }).click();
  const installFixtures = page.getByRole("button", { name: "Install fixture accounts" });
  const catalogHeading = page.getByRole("heading", { name: "Account catalog" });
  await expect(installFixtures.or(catalogHeading)).toBeVisible();
  if (await installFixtures.isVisible()) {
    await installFixtures.click();
    await expect(catalogHeading).toBeVisible();
  }
  const catalog = catalogHeading.locator("../..");
  const accountRow = catalog.locator(".divide-y > div").filter({ hasText: accountName });
  await accountRow.getByRole("button", { name: "Make available" }).click();
  await expect(accountRow.getByRole("button", { name: "Remove from agency" })).toBeVisible();
  const secondAccountRow = catalog.locator(".divide-y > div").filter({ hasText: secondAccountName });
  await secondAccountRow.getByRole("button", { name: "Make available" }).click();
  await expect(secondAccountRow.getByRole("button", { name: "Remove from agency" })).toBeVisible();
  await page.goto(`${agencyUrl}/accounts?q=Harbor&provider=ga4&availability=available`);
  await expect(page.getByText(secondAccountName, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(accountName, { exact: true })).toHaveCount(0);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, adminEmail, adminPassword);
  await adminPage.goto(`${agencyUrl}/accounts`);
  await expect(adminPage.getByText(accountName, { exact: true }).first()).toBeVisible();
  await expect(adminPage.getByText(secondAccountName, { exact: true }).first()).toBeVisible();
  await expect(adminPage.getByText("Northstar Google Ads", { exact: true })).toHaveCount(0);
  const clientGrants = adminPage.getByRole("heading", { name: "Client grants" }).locator("../..");
  const clientBlock = clientGrants.locator(":scope > .divide-y > div").filter({ hasText: clientEmail });
  const clientAccount = clientBlock.locator(".grid > div").filter({ hasText: accountName });
  await clientAccount.getByRole("button", { name: "Grant" }).click();
  await expect(clientAccount.getByRole("button", { name: "Revoke" })).toBeVisible();
  const secondClientBlock = clientGrants.locator(":scope > .divide-y > div").filter({ hasText: secondClientEmail });
  const secondClientFirstAccount = secondClientBlock.locator(".grid > div").filter({ hasText: accountName });
  const secondClientSecondAccount = secondClientBlock.locator(".grid > div").filter({ hasText: secondAccountName });
  await secondClientFirstAccount.getByRole("button", { name: "Grant" }).click();
  await expect(secondClientFirstAccount.getByRole("button", { name: "Revoke" })).toBeVisible();
  await secondClientSecondAccount.getByRole("button", { name: "Grant" }).click();
  await expect(secondClientSecondAccount.getByRole("button", { name: "Revoke" })).toBeVisible();

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await signIn(clientPage, clientEmail, clientPassword);
  await expect(clientPage.getByRole("heading", { name: "Assigned accounts" })).toBeVisible();
  await expect(clientPage.getByText(accountName, { exact: true })).toBeVisible();
  await clientPage.getByRole("link", { name: "Open analytics" }).click();
  await expect(clientPage.getByRole("heading", { name: "Analytics service setup in progress" })).toBeVisible();
  expect((await clientPage.request.post("/api/dashboards/ga4/guest-token")).status()).toBe(503);
  await clientPage.goto(`${agencyUrl}/accounts`);
  await expect(clientPage).toHaveURL(/\/dashboard$/);

  const secondClientContext = await browser.newContext();
  const secondClientPage = await secondClientContext.newPage();
  await signIn(secondClientPage, secondClientEmail, secondClientPassword);
  await expect(secondClientPage.getByText(accountName, { exact: true })).toBeVisible();
  await expect(secondClientPage.getByText(secondAccountName, { exact: true })).toBeVisible();

  await adminPage.goto(`${agencyUrl}/accounts`);
  const refreshedClientGrants = adminPage.getByRole("heading", { name: "Client grants" }).locator("../..");
  const refreshedClientBlock = refreshedClientGrants.locator(":scope > .divide-y > div").filter({ hasText: clientEmail });
  const refreshedClientAccount = refreshedClientBlock.locator(".grid > div").filter({ hasText: accountName });
  await refreshedClientAccount.getByRole("button", { name: "Revoke" }).click();
  await expect(refreshedClientAccount.getByRole("button", { name: "Grant" })).toBeVisible();
  await clientPage.reload();
  await expect(clientPage.getByText(accountName, { exact: true })).toHaveCount(0);
  await expect(clientPage.getByText("No accounts have been assigned yet.")).toBeVisible();
  expect((await clientPage.request.post("/api/dashboards/ga4/guest-token")).status()).toBe(403);
  await secondClientPage.reload();
  await expect(secondClientPage.getByText(accountName, { exact: true })).toBeVisible();
  await expect(secondClientPage.getByText(secondAccountName, { exact: true })).toBeVisible();

  await page.goto("/dashboard/audit?resource=account_grant&result=allowed&q=revoke");
  await expect(page.getByText("account_grant.revoke", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("account_grant.create", { exact: true })).toHaveCount(0);

  await clientContext.close();
  await secondClientContext.close();
  await adminContext.close();
});
