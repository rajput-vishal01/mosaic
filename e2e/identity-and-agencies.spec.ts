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

test("enforces platform, agency, and client boundaries", async ({ browser, page, request }) => {
  test.setTimeout(60_000);
  const nonce = Date.now().toString();
  const initialAgencyName = `E2E Agency ${nonce}`;
  const agencyName = `${initialAgencyName} Updated`;
  const agencySlug = `e2e-agency-${nonce}`;
  const adminEmail = `agency-admin-${nonce}@mosaic.local`;
  const clientEmail = `client-${nonce}@mosaic.local`;
  const agencyPassword = `MosaicAgency!${nonce}`;
  const clientPassword = `MosaicClient!${nonce}`;

  await signIn(page, superadminEmail, superadminPassword);
  await page.getByRole("link", { name: "Manage connections" }).click();
  await expect(page.getByRole("heading", { name: "Connections" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Test connection" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Authorize with Google" })).toBeDisabled();
  await page.goto("/api/connections/ga4/callback?state=invalid&secret_id=invalid");
  await expect(page).toHaveURL(/\/dashboard\/connections\?ga4=invalid_callback$/);
  await expect(page.getByText("The GA4 callback was incomplete.")).toBeVisible();
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Manage agencies" }).click();
  await page.getByLabel("Agency name").fill(initialAgencyName);
  await page.getByLabel("URL slug").fill(agencySlug);
  await page.getByRole("button", { name: "Create agency" }).click();
  await expect(page.getByRole("link", { name: initialAgencyName })).toBeVisible();
  await page.getByRole("link", { name: initialAgencyName }).click();

  await page.getByText("Agency settings").click();
  const settingsForm = page.locator("details").filter({ hasText: "Agency settings" });
  await settingsForm.getByLabel("Agency name").fill(agencyName);
  await settingsForm.getByRole("button", { name: "Save" }).click();
  await expect(settingsForm.getByRole("status")).toHaveText("Agency details updated.");
  await expect(page.getByRole("heading", { name: agencyName })).toBeVisible();

  await page.getByText("Create credentials directly").click();
  const credentialForm = page.locator("details").filter({ hasText: "Create credentials directly" });
  await credentialForm.getByLabel("Full name").fill("E2E Agency Admin");
  await credentialForm.getByLabel("Email").fill(adminEmail);
  await credentialForm.getByLabel("Temporary password").fill(agencyPassword);
  await credentialForm.getByLabel("Agency role").selectOption("admin");
  await credentialForm.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText(adminEmail)).toBeVisible();

  const agencyUrl = page.url();
  const agencyAdminContext = await browser.newContext();
  const agencyAdminPage = await agencyAdminContext.newPage();
  await signIn(agencyAdminPage, adminEmail, agencyPassword);
  await expect(agencyAdminPage.getByRole("link", { name: "Manage users" })).toBeVisible();
  await agencyAdminPage.goto("/dashboard/analytics");
  await expect(agencyAdminPage).toHaveURL(/\/dashboard$/);
  await agencyAdminPage.goto("/dashboard/connections");
  await expect(agencyAdminPage).toHaveURL(/\/dashboard$/);
  await agencyAdminPage.goto("/dashboard/agencies");
  await expect(agencyAdminPage).toHaveURL(/\/dashboard$/);

  const secondAgencyName = `Second Agency ${nonce}`;
  await page.goto("/dashboard/agencies");
  await page.getByLabel("Agency name").fill(secondAgencyName);
  await page.getByLabel("URL slug").fill(`second-agency-${nonce}`);
  await page.getByRole("button", { name: "Create agency" }).click();
  await page.getByRole("link", { name: secondAgencyName }).click();
  await expect(page).toHaveURL(/\/dashboard\/agencies\/[^/]+$/);
  const secondAgencyUrl = page.url();
  await page.getByLabel("Email address").fill(adminEmail);
  await page.getByLabel("Agency role").first().selectOption("admin");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect.poll(async () => {
    const data = await (await request.get("http://127.0.0.1:8026/api/v1/messages")).json() as { messages: Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }> };
    return data.messages.find((message) => message.Subject === `Join ${secondAgencyName} in Mosaic` && message.To.some((recipient) => recipient.Address === adminEmail))?.ID;
  }).toBeTruthy();
  const adminMessages = await (await request.get("http://127.0.0.1:8026/api/v1/messages")).json() as { messages: Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }> };
  const adminMessageId = adminMessages.messages.find((message) => message.Subject === `Join ${secondAgencyName} in Mosaic` && message.To.some((recipient) => recipient.Address === adminEmail))!.ID;
  const adminMessage = await (await request.get(`http://127.0.0.1:8026/api/v1/message/${adminMessageId}`)).json() as { HTML: string };
  const adminInvitationUrl = /href="([^"]*accept-invitation[^"]*)"/.exec(adminMessage.HTML)?.[1]?.replaceAll("&amp;", "&");
  await agencyAdminPage.goto(adminInvitationUrl!);
  await agencyAdminPage.getByLabel("Existing account password").fill(agencyPassword);
  await agencyAdminPage.getByRole("button", { name: "Sign in and accept" }).click();
  await expect(agencyAdminPage).toHaveURL(/\/dashboard$/);
  await expect(agencyAdminPage.getByRole("heading", { name: "Your agencies" })).toBeVisible();
  await expect(agencyAdminPage.getByRole("link", { name: agencyName })).toBeVisible();
  await expect(agencyAdminPage.getByRole("link", { name: secondAgencyName })).toBeVisible();
  await agencyAdminPage.getByRole("button", { name: "Sign out" }).click();
  await expect(agencyAdminPage).toHaveURL(/\/login$/);
  await signIn(agencyAdminPage, adminEmail, agencyPassword);
  await agencyAdminPage.goto(secondAgencyUrl);
  await expect(agencyAdminPage.getByRole("heading", { name: secondAgencyName })).toBeVisible();
  await agencyAdminPage.goto(agencyUrl);

  const cancelledEmail = `cancelled-${nonce}@mosaic.local`;
  await agencyAdminPage.getByLabel("Email address").fill(cancelledEmail);
  await agencyAdminPage.getByLabel("Agency role").first().selectOption("member");
  await agencyAdminPage.getByRole("button", { name: "Send invitation" }).click();
  const invitationSection = agencyAdminPage.getByRole("heading", { name: "Pending invitations" }).locator("../..");
  const cancelledInvitation = invitationSection.locator(".divide-y > div").filter({ hasText: cancelledEmail });
  await cancelledInvitation.getByRole("button", { name: "Resend" }).click();
  await expect(cancelledInvitation).toBeVisible();
  await cancelledInvitation.getByRole("button", { name: "Cancel" }).click();
  await expect(cancelledInvitation).toHaveCount(0);

  await agencyAdminPage.getByLabel("Email address").fill(clientEmail);
  await agencyAdminPage.getByLabel("Agency role").first().selectOption("member");
  await agencyAdminPage.getByRole("button", { name: "Send invitation" }).click();
  await expect(agencyAdminPage.getByText(clientEmail, { exact: true })).toBeVisible();

  await expect.poll(async () => {
    const data = await (await request.get("http://127.0.0.1:8026/api/v1/messages")).json() as { messages: Array<{ ID: string; To: Array<{ Address: string }> }> };
    return data.messages.find((message) => message.To.some((recipient) => recipient.Address === clientEmail))?.ID;
  }).toBeTruthy();
  const messages = await (await request.get("http://127.0.0.1:8026/api/v1/messages")).json() as { messages: Array<{ ID: string; To: Array<{ Address: string }> }> };
  const messageId = messages.messages.find((message) => message.To.some((recipient) => recipient.Address === clientEmail))!.ID;
  const message = await (await request.get(`http://127.0.0.1:8026/api/v1/message/${messageId}`)).json() as { HTML: string };
  const invitationUrl = /href="([^"]*accept-invitation[^"]*)"/.exec(message.HTML)?.[1]?.replaceAll("&amp;", "&");
  expect(invitationUrl).toBeTruthy();

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto(invitationUrl!);
  await clientPage.getByLabel("Full name").fill("E2E Client");
  await clientPage.getByLabel("Password", { exact: true }).fill(clientPassword);
  await clientPage.getByLabel("Confirm password").fill(clientPassword);
  await clientPage.getByRole("button", { name: "Accept invitation" }).click();
  await expect(clientPage.getByText("Your account is ready")).toBeVisible();
  await clientContext.clearCookies();
  await signIn(clientPage, clientEmail, clientPassword);
  await expect(clientPage.getByText("Client user", { exact: true })).toBeVisible();
  await expect(clientPage.getByText(agencyName)).toBeVisible();
  await clientPage.reload();
  await expect(clientPage.getByText(agencyName)).toBeVisible();
  await clientPage.goto(agencyUrl);
  await expect(clientPage).toHaveURL(/\/dashboard$/);

  await page.goto("/dashboard/agencies");
  const agencyRow = page.locator(".divide-y > div").filter({ hasText: agencyName });
  await agencyRow.getByRole("button", { name: "Suspend" }).click();
  await expect(agencyRow.getByRole("button", { name: "Restore" })).toBeVisible();
  await clientPage.reload();
  await expect(clientPage.getByRole("heading", { name: "Agency access suspended" })).toBeVisible();
  await agencyRow.getByRole("button", { name: "Restore" }).click();
  await expect(agencyRow.getByRole("button", { name: "Suspend" })).toBeVisible();
  await clientPage.reload();
  await expect(clientPage.getByText(agencyName)).toBeVisible();

  await clientContext.clearCookies();
  await clientPage.goto("/forgot-password");
  await clientPage.getByLabel("Email").fill(clientEmail);
  await clientPage.getByRole("button", { name: "Send reset link" }).click();
  await expect(clientPage.getByText("a reset link is on its way", { exact: false })).toBeVisible();
  await expect.poll(async () => {
    const data = await (await request.get("http://127.0.0.1:8026/api/v1/messages")).json() as { messages: Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }> };
    return data.messages.find((message) => message.Subject === "Reset your Mosaic password" && message.To.some((recipient) => recipient.Address === clientEmail))?.ID;
  }).toBeTruthy();
  const resetMessages = await (await request.get("http://127.0.0.1:8026/api/v1/messages")).json() as { messages: Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }> };
  const resetMessageId = resetMessages.messages.find((message) => message.Subject === "Reset your Mosaic password" && message.To.some((recipient) => recipient.Address === clientEmail))!.ID;
  const resetMessage = await (await request.get(`http://127.0.0.1:8026/api/v1/message/${resetMessageId}`)).json() as { HTML: string };
  const resetUrl = /href="([^"]*api\/auth\/reset-password[^"]*)"/.exec(resetMessage.HTML)?.[1]?.replaceAll("&amp;", "&");
  expect(resetUrl).toBeTruthy();
  const newClientPassword = `MosaicChanged!${nonce}`;
  await clientPage.goto(resetUrl!);
  await clientPage.getByLabel("New password").fill(newClientPassword);
  await clientPage.getByLabel("Confirm password").fill(newClientPassword);
  await clientPage.getByRole("button", { name: "Update password" }).click();
  await expect(clientPage).toHaveURL(/\/login\?reset=success$/);
  await clientPage.goto(resetUrl!);
  await expect(clientPage.getByText("invalid or has expired", { exact: false })).toBeVisible();
  await signIn(clientPage, clientEmail, newClientPassword);

  await page.goto(agencyUrl);
  const usersSection = page.getByRole("heading", { name: "Users" }).locator("../..");
  const clientRow = usersSection.locator(".divide-y > div").filter({ hasText: clientEmail });
  await clientRow.getByRole("button", { name: "Suspend" }).click();
  await expect(clientRow.getByRole("button", { name: "Restore" })).toBeVisible();
  await clientPage.reload();
  await expect(clientPage).toHaveURL(/\/login$/);

  await clientContext.close();
  await agencyAdminContext.close();
});
