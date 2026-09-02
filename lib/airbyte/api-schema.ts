// Narrow OpenAPI contract derived from Airbyte's public API schema.
// Keep this surface intentionally small until a deployed instance can generate
// and verify the complete client contract against its own OpenAPI document.
export interface AirbyteApiPaths {
  "/health": {
    get: {
      responses: {
        200: { content: { "application/json": Record<string, never> } };
      };
    };
  };
  "/applications/token": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            client_id: string;
            client_secret: string;
            "grant-type": "client_credentials";
          };
        };
      };
      responses: {
        200: {
          content: {
            "application/json": {
              access_token: string;
              expires_in?: number;
              token_type?: string;
            };
          };
        };
        400: { content: { "application/json": unknown } };
        403: { content: { "application/json": unknown } };
      };
    };
  };
  "/workspaces/{workspaceId}": {
    get: {
      parameters: { path: { workspaceId: string } };
      responses: {
        200: {
          content: {
            "application/json": {
              workspaceId: string;
              name: string;
            };
          };
        };
        403: { content: { "application/json": unknown } };
        404: { content: { "application/json": unknown } };
      };
    };
  };
}
