import { z } from "zod";

const propertyIdSchema = z.string().trim().regex(/^\d{5,20}$/, "GA4 property IDs must contain only digits.");

export const ga4SetupSchema = z.object({
  label: z.string().trim().min(2, "Enter a connection name.").max(80),
  propertyIds: z.string().transform((value) => [...new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))]).pipe(z.array(propertyIdSchema).min(1, "Enter at least one GA4 property ID.").max(50, "Connect at most 50 properties at once.")),
  startDate: z.string().trim().refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Use YYYY-MM-DD.").transform((value) => value || undefined),
});
