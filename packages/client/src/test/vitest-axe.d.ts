import "vitest";
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  // biome-ignore lint/suspicious/noExplicitAny: mirrors the vitest-axe documented augmentation
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
