import { z } from "zod";
import { evaluateFormula, FormulaError, formulaReferences, parseFormula } from "./formula.ts";

/** A label is either a translation key of the system's locale files or inline per-locale text. */
export const labelSchema = z.union([z.string().max(200), z.record(z.string(), z.string().max(200))]);
export type Label = z.infer<typeof labelSchema>;

const fieldId = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(40);
const base = { id: fieldId, label: labelSchema.optional() };

const scalarFieldSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("text"), multiline: z.boolean().optional(), default: z.string().max(5000).optional() }),
  z.object({ ...base, type: z.literal("number"), default: z.number().optional(), min: z.number().optional(), max: z.number().optional() }),
  z.object({ ...base, type: z.literal("checkbox"), default: z.boolean().optional() }),
  z.object({
    ...base,
    type: z.literal("select"),
    options: z
      .array(z.object({ value: z.string().max(60), label: labelSchema.optional() }))
      .min(1)
      .max(100),
    default: z.string().optional(),
  }),
  z.object({ ...base, type: z.literal("computed"), formula: z.string().max(500) }),
]);

const listFieldSchema = z.object({
  ...base,
  type: z.literal("list"),
  itemFields: z
    .array(scalarFieldSchema.refine((f) => f.type !== "computed", "computed fields are not allowed in lists"))
    .min(1)
    .max(20),
});

export const fieldSchema = z.union([scalarFieldSchema, listFieldSchema]);
export type SheetField = z.infer<typeof fieldSchema>;

export const sheetTemplateSchema = z
  .object({
    sections: z.array(z.object({ id: fieldId, label: labelSchema.optional(), fields: z.array(fieldSchema).max(200) })).max(30),
  })
  .superRefine((template, ctx) => {
    const fields = template.sections.flatMap((s) => s.fields);
    const ids = new Set<string>();
    for (const f of fields) {
      if (ids.has(f.id)) ctx.addIssue({ code: "custom", message: `duplicate field ${f.id}` });
      ids.add(f.id);
    }
    for (const f of fields) {
      if (f.type !== "computed") continue;
      try {
        for (const ref of formulaReferences(parseFormula(f.formula)))
          if (!ids.has(ref)) ctx.addIssue({ code: "custom", message: `${f.id} references unknown field ${ref}` });
      } catch (error) {
        ctx.addIssue({ code: "custom", message: `${f.id}: ${(error as Error).message}` });
      }
    }
  });
export type SheetTemplate = z.infer<typeof sheetTemplateSchema>;

export type SheetValue = string | number | boolean | null | Record<string, string | number | boolean>[];
export type SheetData = Record<string, SheetValue>;

export function allFields(template: SheetTemplate): SheetField[] {
  return template.sections.flatMap((s) => s.fields);
}

function defaultFor(field: SheetField): SheetValue {
  switch (field.type) {
    case "text":
      return field.default ?? "";
    case "number":
      return field.default ?? 0;
    case "checkbox":
      return field.default ?? false;
    case "select":
      return field.default ?? field.options[0]!.value;
    case "list":
      return [];
    case "computed":
      return null;
  }
}

/** Applies defaults for missing fields and evaluates computed fields (null when a formula fails). */
export function computeSheet(template: SheetTemplate, data: SheetData): SheetData {
  const fields = allFields(template);
  const byId = new Map(fields.map((f) => [f.id, f]));
  const values: SheetData = {};
  for (const f of fields) if (f.type !== "computed") values[f.id] = data[f.id] ?? defaultFor(f);

  const resolving = new Set<string>();
  const resolve = (id: string): SheetValue => {
    if (id in values) return values[id]!;
    const field = byId.get(id);
    if (!field || field.type !== "computed" || resolving.has(id)) throw new FormulaError(`cannot resolve ${id}`);
    resolving.add(id);
    try {
      const result = evaluateFormula(parseFormula(field.formula), (name) => {
        const v = resolve(name);
        if (typeof v === "number") return v;
        if (typeof v === "boolean") return v ? 1 : 0;
        throw new FormulaError(`${name} is not numeric`);
      });
      values[id] = Number.isFinite(result) ? result : null;
    } catch {
      values[id] = null;
    } finally {
      resolving.delete(id);
    }
    return values[id]!;
  };
  for (const f of fields) if (f.type === "computed") resolve(f.id);
  return values;
}

/**
 * Checks user-submitted values against the template. Computed fields cannot be written;
 * unknown fields and wrongly typed values are rejected.
 */
export function validateSheetData(template: SheetTemplate, data: unknown): data is SheetData {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return false;
  const byId = new Map(allFields(template).map((f) => [f.id, f]));
  return Object.entries(data).every(([id, value]) => {
    const field = byId.get(id);
    return field !== undefined && field.type !== "computed" && valueMatches(field, value);
  });
}

function valueMatches(field: SheetField, value: unknown): boolean {
  switch (field.type) {
    case "text":
      return typeof value === "string" && value.length <= 5000;
    case "number":
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        (field.min === undefined || value >= field.min) &&
        (field.max === undefined || value <= field.max)
      );
    case "checkbox":
      return typeof value === "boolean";
    case "select":
      return typeof value === "string" && field.options.some((o) => o.value === value);
    case "list":
      return (
        Array.isArray(value) &&
        value.length <= 200 &&
        value.every(
          (row) =>
            typeof row === "object" &&
            row !== null &&
            Object.entries(row).every(([key, v]) => {
              const itemField = field.itemFields.find((f) => f.id === key);
              return itemField !== undefined && valueMatches(itemField, v);
            }),
        )
      );
    case "computed":
      return false;
  }
}

/** Resolves a label for a locale: inline per-locale text, then the system's locale file, then the raw key. */
export function resolveLabel(
  label: Label | undefined,
  locale: string,
  systemStrings: Record<string, Record<string, string>> | undefined,
  fallbackId: string,
): string {
  if (label === undefined) return fallbackId;
  if (typeof label === "object") return label[locale] ?? label.en ?? fallbackId;
  return systemStrings?.[locale]?.[label] ?? systemStrings?.en?.[label] ?? label;
}

export const actorTypeSchema = z.enum(["character", "npc"]);
export type ActorType = z.infer<typeof actorTypeSchema>;

/**
 * Optional `compendium.json` of a system: monsters become an NPC sheet plus a linked token when placed on the
 * map, items only a token. `data` follows the NPC template.
 */
export const compendiumSchema = z
  .array(
    z.object({
      id: z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]*$/)
        .max(60),
      name: z.string().min(1).max(60),
      kind: z.enum(["monster", "item"]),
      size: z.number().min(0.25).max(20).default(1),
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .default("#8a5a44"),
      data: z.record(z.string(), z.unknown()).default({}),
    }),
  )
  .max(2000);
export type CompendiumEntry = z.infer<typeof compendiumSchema>[number];

export const systemManifestSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .max(40),
  name: z.string().min(1).max(80),
  version: z.string().max(20),
  author: z.string().max(120),
  license: z.string().max(60),
  /** Required for systems whose license demands credit (e.g. CC-BY). Shown in the UI. */
  attribution: z.string().max(1000).optional(),
  minOpenVTT: z.string().max(20),
  actorTypes: z.partialRecord(actorTypeSchema, z.object({ template: z.string().max(120) })),
  locales: z.array(z.string().max(10)).min(1),
});
export type SystemManifest = z.infer<typeof systemManifestSchema>;
