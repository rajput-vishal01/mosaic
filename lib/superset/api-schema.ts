export interface SupersetApiPaths {
  "/api/v1/security/login": {
    post: {
      requestBody: { content: { "application/json": { username: string; password: string; provider: "db"; refresh: true } } };
      responses: {
        200: { content: { "application/json": { access_token: string; refresh_token?: string } } };
        400: { content: { "application/json": unknown } };
        401: { content: { "application/json": unknown } };
        500: { content: { "application/json": unknown } };
      };
    };
  };
  "/api/v1/security/guest_token/": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            resources: Array<{ type: "dashboard"; id: string }>;
            rls: Array<{ clause: string }>;
            user: { username: string; first_name: string; last_name: string };
          };
        };
      };
      responses: {
        200: { content: { "application/json": { token: string } } };
        400: { content: { "application/json": unknown } };
        401: { content: { "application/json": unknown } };
        500: { content: { "application/json": unknown } };
      };
    };
  };
}
