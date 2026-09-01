import { createLoader, createSerializer, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { providerKeys } from "./fixtures";

export const availabilityFilters = ["all", "available", "unavailable"] as const;

export const accountSearchParsers = {
  q: parseAsString.withDefault(""),
  provider: parseAsStringLiteral(providerKeys),
  availability: parseAsStringLiteral(availabilityFilters).withDefault("all"),
  client: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
};

export const loadAccountSearchParams = createLoader(accountSearchParsers);
export const serializeAccountSearchParams = createSerializer(accountSearchParsers);
