import { render } from "react-email";
import { describe, expect, it } from "vitest";

import { PasswordResetEmail } from "./password-reset-email";
import { AgencyInvitationEmail } from "./agency-invitation-email";

describe("password reset email", () => {
  it("renders the recipient-safe one-time reset call to action", async () => {
    const html = await render(
      <PasswordResetEmail name="Avery" resetUrl="https://mosaic.example/reset/token" />,
    );

    expect(html).toContain("Hi <!-- -->Avery");
    expect(html).toContain("https://mosaic.example/reset/token");
    expect(html).toContain("expires in one hour");
  });
});

describe("agency invitation email", () => {
  it("renders the agency and opaque invitation link", async () => {
    const html = await render(<AgencyInvitationEmail agencyName="Northstar" inviterName="Avery" invitationUrl="https://mosaic.example/accept/opaque-id" />);
    expect(html).toContain("Join <!-- -->Northstar");
    expect(html).toContain("https://mosaic.example/accept/opaque-id");
    expect(html).toContain("expires in 48 hours");
  });
});
