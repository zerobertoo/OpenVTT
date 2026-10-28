import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Checkbox, Switch } from "./checkbox";
import { Field } from "./field";
import { Input, Select, Textarea } from "./input";

describe("Field", () => {
  it("links the label, hint and error to the control", () => {
    render(
      <Field label="Password" hint="At least 8 characters." error="Too short.">
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("At least 8 characters. Too short.");
    expect(screen.getByRole("alert")).toHaveTextContent("Too short.");
  });

  it("does not mark the control invalid without an error", () => {
    render(<Field label="Name">{(control) => <Input {...control} />}</Field>);
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("gives every field its own id", () => {
    render(
      <>
        <Field label="One">{(control) => <Input {...control} />}</Field>
        <Field label="Two">{(control) => <Input {...control} />}</Field>
      </>,
    );
    expect(screen.getByLabelText("One").id).not.toBe(screen.getByLabelText("Two").id);
  });

  it("has no accessibility violations across controls", async () => {
    const { container } = render(
      <form>
        <Field label="Text">{(c) => <Input {...c} />}</Field>
        <Field label="Notes" error="Required">
          {(c) => <Textarea {...c} />}
        </Field>
        <Field label="System">
          {(c) => (
            <Select {...c}>
              <option>Generic</option>
            </Select>
          )}
        </Field>
        <Field label="Remember me" inline>
          {(c) => <Checkbox {...c} />}
        </Field>
        <Field label="Visible" inline>
          {(c) => <Switch {...c} />}
        </Field>
      </form>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Switch", () => {
  it("is a switch that toggles with the keyboard", async () => {
    const onChange = vi.fn();
    render(
      <Field label="Visible" inline>
        {(c) => <Switch {...c} onChange={(e) => onChange(e.target.checked)} />}
      </Field>,
    );
    const toggle = screen.getByRole("switch", { name: "Visible" });
    expect(toggle).not.toBeChecked();
    await userEvent.tab();
    expect(toggle).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(toggle).toBeChecked();
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
