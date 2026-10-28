import type { Preview } from "@storybook/react-vite";
import { useEffect } from "react";
import "../src/i18n";
import { setLocale } from "../src/i18n";
import "../src/styles.css";

type ThemeChoice = "system" | "light" | "dark";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { expanded: true },
    // Violations show in the a11y panel; the e2e suite is what fails the build.
    a11y: { test: "todo" },
  },
  initialGlobals: { theme: "system", locale: "en" },
  globalTypes: {
    theme: {
      description: "Color theme (system follows the browser)",
      toolbar: { title: "Theme", icon: "circlehollow", items: ["system", "light", "dark"], dynamicTitle: true },
    },
    locale: {
      description: "Interface language",
      toolbar: { title: "Language", icon: "globe", items: ["en", "pt-br"], dynamicTitle: true },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as ThemeChoice;
      const locale = context.globals.locale as "en" | "pt-br";
      useEffect(() => {
        // `styles.css` reads data-theme to force light or dark; without it the browser decides.
        if (theme === "system") document.documentElement.removeAttribute("data-theme");
        else document.documentElement.dataset.theme = theme;
      }, [theme]);
      useEffect(() => setLocale(locale), [locale]);
      return (
        <div className="bg-bg p-6 text-ink">
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
