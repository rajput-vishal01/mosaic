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
  "/jobs": {
    get: {
      parameters: {
        query?: {
          connectionId?: string;
          limit?: number;
          jobType?: "sync" | "reset";
          orderBy?: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": {
              data: Array<{
                jobId: number;
                status: "pending" | "queued" | "running" | "incomplete" | "failed" | "succeeded" | "cancelled";
                jobType: "sync" | "reset" | "refresh" | "clear";
                startTime: string;
                connectionId: string;
                lastUpdatedAt?: string;
                duration?: string;
                bytesSynced?: number;
                rowsSynced?: number;
              }>;
              previous?: string;
              next?: string;
            };
          };
        };
        403: { content: { "application/json": unknown } };
      };
    };
  };
  "/sources/initiateOAuth": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            redirectUrl: string;
            workspaceId: string;
            sourceType: "google-analytics-data-api";
          };
        };
      };
      responses: {
        200: { content: { "application/json": { redirect_url: string } } };
        400: { content: { "application/json": unknown } };
        403: { content: { "application/json": unknown } };
      };
    };
  };
  "/sources": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            name: string;
            workspaceId: string;
            secretId: string;
            configuration: {
              sourceType: "google-analytics-data-api";
              property_ids: string[];
              date_ranges_start_date?: string;
            };
          };
        };
      };
      responses: {
        200: { content: { "application/json": { sourceId: string } } };
        400: { content: { "application/json": unknown } };
        403: { content: { "application/json": unknown } };
      };
    };
  };
  "/sources/{sourceId}": {
    delete: {
      parameters: { path: { sourceId: string } };
      responses: {
        204: { content: never };
        403: { content: { "application/json": unknown } };
        404: { content: { "application/json": unknown } };
      };
    };
  };
  "/connections": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            name: string;
            sourceId: string;
            destinationId: string;
          };
        };
      };
      responses: {
        200: { content: { "application/json": { connectionId: string } } };
        400: { content: { "application/json": unknown } };
        403: { content: { "application/json": unknown } };
      };
    };
  };
  "/connections/{connectionId}": {
    delete: {
      parameters: { path: { connectionId: string } };
      responses: {
        204: { content: never };
        403: { content: { "application/json": unknown } };
        404: { content: { "application/json": unknown } };
      };
    };
  };
}
