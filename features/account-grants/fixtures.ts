export const fixtureSourceAccounts = [
  { provider: "ga4", externalAccountId: "ga4-northstar", name: "Northstar Web Analytics", metadata: { propertyId: "100001" } },
  { provider: "ga4", externalAccountId: "ga4-harbor", name: "Harbor Web Analytics", metadata: { propertyId: "100002" } },
  { provider: "google_ads", externalAccountId: "ads-northstar", name: "Northstar Google Ads", metadata: { customerId: "200-001-0001" } },
  { provider: "google_ads", externalAccountId: "ads-harbor", name: "Harbor Google Ads", metadata: { customerId: "200-001-0002" } },
  { provider: "meta_ads", externalAccountId: "meta-northstar", name: "Northstar Meta Ads", metadata: { accountId: "act_300001" } },
  { provider: "meta_ads", externalAccountId: "meta-harbor", name: "Harbor Meta Ads", metadata: { accountId: "act_300002" } },
  { provider: "google_search_console", externalAccountId: "gsc-northstar", name: "Northstar Search Console", metadata: { siteUrl: "https://northstar.example" } },
  { provider: "google_search_console", externalAccountId: "gsc-harbor", name: "Harbor Search Console", metadata: { siteUrl: "https://harbor.example" } },
  { provider: "google_business_profile", externalAccountId: "gbp-northstar", name: "Northstar Business Profile", metadata: { locationId: "400001" } },
  { provider: "google_business_profile", externalAccountId: "gbp-harbor", name: "Harbor Business Profile", metadata: { locationId: "400002" } },
] as const;

export type ProviderKey = (typeof fixtureSourceAccounts)[number]["provider"];

export const providerLabels: Record<ProviderKey, string> = {
  ga4: "Google Analytics 4",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  google_search_console: "Google Search Console",
  google_business_profile: "Google Business Profile",
};

export const fixtureAuthorizationLabel = "Phase 2 fixture catalog";
