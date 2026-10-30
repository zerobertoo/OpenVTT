import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

const html = (source: string) => render(<Markdown source={source} />).container.innerHTML;

describe("markdown in handouts", () => {
  it("renders headings, lists, emphasis, links and world images", () => {
    const out = html(
      "# Town\nSome **bold** and *soft* words with `code`.\n\n- one\n- [map](https://example.com/x)\n\n![gate](asset:123e4567-e89b-12d3-a456-426614174000)",
    );
    expect(out).toContain("<h4>Town</h4>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>soft</em>");
    expect(out).toContain("<code>code</code>");
    expect(out).toContain("<li>one</li>");
    expect(out).toContain('href="https://example.com/x"');
    expect(out).toContain('src="/api/assets/123e4567-e89b-12d3-a456-426614174000"');
  });

  it("never turns text into markup or scripts, and shows outside images only as links", () => {
    const out = html("<img src=x onerror=alert(1)> [x](javascript:alert(1)) ![y](https://evil.example/p.png)");
    expect(out).not.toContain("<img");
    expect(out).not.toContain('href="javascript');
    expect(out).toContain("&lt;img");
  });
});
