import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, expect } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";
import en from "../i18n/en.json";

expect.extend(axeMatchers);

// Tests always run in English so assertions can read the visible text.
void i18n.use(initReactI18next).init({ lng: "en", resources: { en: { translation: en } }, interpolation: { escapeValue: false } });

// jsdom has no canvas; axe probes it for color-contrast, which e2e covers in a real browser instead.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

afterEach(cleanup);
