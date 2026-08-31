import { render } from "react-email";
import { describe, expect, it } from "vitest";

import { PasswordResetEmail } from "./password-reset-email";

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
