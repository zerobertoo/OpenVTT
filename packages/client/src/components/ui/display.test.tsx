import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Avatar, AvatarStack } from "./avatar";
import { Badge } from "./badge";
import { Card } from "./card";

describe("Avatar", () => {
  it("shows the first letter, upper-cased, and is hidden from assistive technology", () => {
    const { container } = render(<Avatar name="ana" />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps a whole emoji or accented letter as the initial", () => {
    render(<Avatar name="Édith" />);
    expect(screen.getByText("É")).toBeInTheDocument();
  });
});

describe("AvatarStack", () => {
  const people = ["Ana", "Bruno", "Carla", "Dani", "Edu", "Fábio", "Gina"].map((name, id) => ({ id: String(id), name }));

  it("collapses the rest into a count and names the group", () => {
    render(<AvatarStack label="7 online" max={5} people={people} />);
    expect(screen.getByRole("group", { name: "7 online" })).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.queryByText("F")).toBeNull();
  });

  it("shows no count when everyone fits", () => {
    render(<AvatarStack label="2 online" people={people.slice(0, 2)} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });
});

describe("display primitives", () => {
  it("has no accessibility violations", async () => {
    const { container } = render(
      <Card as="section" aria-label="Worlds">
        <Card as="article" variant="inset" aria-label="One world">
          <Avatar name="Mesa" />
          <Badge tone="accent">Game master</Badge>
          <Badge>Hidden</Badge>
          <AvatarStack
            label="2 online"
            people={[
              { id: "1", name: "Ana" },
              { id: "2", name: "Bia" },
            ]}
          />
        </Card>
      </Card>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
