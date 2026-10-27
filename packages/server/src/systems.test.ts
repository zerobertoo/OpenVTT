import { resolve } from "node:path";
import { computeSheet, resolveLabel } from "@openvtt/sdk";
import { describe, expect, it } from "vitest";
import { SystemRegistry } from "./systems.ts";

const registry = new SystemRegistry(resolve(import.meta.dirname, "../../../systems"), "/nonexistent");

describe("built-in systems", () => {
  it("loads the generic and D&D 5e SRD packages with matching locales", () => {
    expect(
      registry
        .list()
        .map((m) => m.id)
        .sort(),
    ).toEqual(["dnd5e-srd", "generic"]);
    for (const id of ["generic", "dnd5e-srd"]) {
      const { strings } = registry.get(id)!;
      expect(Object.keys(strings["pt-br"]!).sort()).toEqual(Object.keys(strings.en!).sort());
    }
  });

  it("declares the SRD attribution required by CC-BY-4.0", () => {
    const manifest = registry.get("dnd5e-srd")!.manifest;
    expect(manifest.license).toBe("CC-BY-4.0");
    expect(manifest.attribution).toContain("System Reference Document 5.1");
  });

  it("computes the SRD character sheet", () => {
    const sheet = registry.get("dnd5e-srd")!.templates.character!;
    const values = computeSheet(sheet, {
      dex: 16,
      level: 5,
      skill_acrobatics_prof: true,
      save_dex_prof: true,
      wis: 14,
      skill_perception_prof: true,
    });
    expect(values).toMatchObject({ dex_mod: 3, proficiency: 3, skill_acrobatics: 6, save_dex: 6, initiative: 3, passive_perception: 15 });
  });

  it("resolves every label used by the SRD templates", () => {
    const system = registry.get("dnd5e-srd")!;
    for (const template of Object.values(system.templates))
      for (const section of template.sections)
        for (const field of [section, ...section.fields]) {
          const text = resolveLabel(field.label, "pt-br", system.strings, field.id);
          expect(text, field.id).not.toBe(field.label);
        }
  });
});
