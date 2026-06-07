import { z } from "zod";

export const ISODateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export const SourceRefSchema = z.object({
  sourceId: z.string().min(1).optional(),
  sourceName: z.string().min(1),
  sourceUrl: z.string().url(),
  collectedAt: ISODateStringSchema,
  confidence: ConfidenceSchema,
  notes: z.string().min(1).optional()
});

export const DataSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  sourceType: z.enum(["official", "commercial", "open-data", "manual-snapshot", "derived"]),
  primary: z.boolean().default(false),
  collectedAt: ISODateStringSchema,
  confidence: ConfidenceSchema,
  termsNotes: z.string().optional(),
  robotsTxtNotes: z.string().optional(),
  notes: z.string().optional()
});

export const SourceIndexSchema = z.object({
  generatedAt: ISODateStringSchema,
  sources: z.array(DataSourceSchema)
});

export const sourcedValueSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z
    .object({
      value: valueSchema,
      source: SourceRefSchema,
      estimated: z.boolean().optional(),
      incomplete: z.boolean().optional(),
      notes: z.string().min(1).optional()
    })
    .superRefine((data, ctx) => {
      if ((data.estimated || data.incomplete) && !data.notes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Estimated or incomplete values must include notes"
        });
      }
    });

export const SourcedStringSchema = sourcedValueSchema(z.string().min(1));
export const SourcedNumberSchema = sourcedValueSchema(z.number().finite());
export const SourcedIntSchema = sourcedValueSchema(z.number().int());
export const SourcedBooleanSchema = sourcedValueSchema(z.boolean());
export const SourcedDateSchema = sourcedValueSchema(ISODateStringSchema);
export const SourcedUrlSchema = sourcedValueSchema(z.string().url());

export const CountryCodeSchema = z.string().regex(/^[A-Z]{3}$/, "Expected FIFA-style three-letter country code");
export const SourcedCountryCodeSchema = sourcedValueSchema(CountryCodeSchema);

export const ConfederationSchema = z.enum(["AFC", "CAF", "CONCACAF", "CONMEBOL", "OFC", "UEFA"]);
export const SourcedConfederationSchema = sourcedValueSchema(ConfederationSchema);

export const GroupLabelSchema = z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]);
export const SourcedGroupLabelSchema = sourcedValueSchema(GroupLabelSchema);

export type Confidence = z.infer<typeof ConfidenceSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type DataSource = z.infer<typeof DataSourceSchema>;
export type SourceIndex = z.infer<typeof SourceIndexSchema>;
export type SourcedValue<T> = {
  value: T;
  source: SourceRef;
  estimated?: boolean;
  incomplete?: boolean;
  notes?: string;
};
