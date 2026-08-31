import "server-only";

import { createMosaicAuth } from "./config";

// This instance is never mounted as an HTTP route. It lets an already-authorized
// agency manager provision credentials through Better Auth without public signup.
export const provisioningAuth = createMosaicAuth({
  allowSignup: true,
  autoSignIn: false,
});
