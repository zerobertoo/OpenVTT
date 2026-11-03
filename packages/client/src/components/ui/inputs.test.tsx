import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ColorPicker } from "./color-picker";
import { Disclosure } from "./disclosure";
import { Field } from "./field";
import { FilePicker } from "./file-picker";
import { Slider } from "./slider";

describe("Slider", () => {
  it("moves with the arrow keys and reports the change and the final value", async () => {
    const onValueChange = vi.fn();
    const onValueCommit = vi.fn();
    render(
      <Slider aria-label="Rotation" min={0} max={360} step={15} value={30} onValueChange={onValueChange} onValueCommit={onValueCommit} />,
    );
    const thumb = screen.getByRole("slider", { name: "Rotation" });
    expect(thumb).toHaveAttribute("aria-valuenow", "30");
    thumb.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalledWith(45);
    expect(onValueCommit).toHaveBeenCalledWith(45);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Slider aria-label="Volume" min={0} max={1} step={0.05} value={0.5} onValueChange={() => undefined} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Disclosure", () => {
  it("shows its content only while open and tells assistive technology", async () => {
    const onOpenChange = vi.fn();
    render(
      <Disclosure title="Library" onOpenChange={onOpenChange}>
        <p>Pictures</p>
      </Disclosure>,
    );
    const toggle = screen.getByRole("button", { name: "Library" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Pictures")).toBeNull();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Pictures")).toBeVisible();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});

describe("ColorPicker", () => {
  function Harness({ onChange }: { onChange: (hex: string) => void }) {
    const [value, setValue] = useState("#e5484d");
    return (
      <Field label="Color">
        {(control) => (
          <ColorPicker
            {...control}
            value={value}
            onChange={(hex) => {
              setValue(hex);
              onChange(hex);
            }}
          />
        )}
      </Field>
    );
  }

  it("shows the current hex, picks a swatch and accepts a typed hex code", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const button = screen.getByRole("button", { name: "Color" });
    expect(button).toHaveTextContent("#e5484d");
    await userEvent.click(button);
    await userEvent.click(await screen.findByRole("button", { name: "#3e63dd" }));
    expect(onChange).toHaveBeenLastCalledWith("#3e63dd");
    const hex = screen.getByLabelText("Hex code");
    fireEvent.change(hex, { target: { value: "#12" } });
    expect(hex).toHaveAttribute("aria-invalid", "true");
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.change(hex, { target: { value: "#AABBCC" } });
    expect(onChange).toHaveBeenLastCalledWith("#aabbcc");
    fireEvent.change(hex, { target: { value: "e5484d" } });
    expect(onChange).toHaveBeenLastCalledWith("#e5484d");
    fireEvent.change(hex, { target: { value: "#fa0" } });
    expect(onChange).toHaveBeenLastCalledWith("#ffaa00");
  });
});

describe("FilePicker", () => {
  it("is labelled by its field, reports the chosen files and shows their name", async () => {
    const onChange = vi.fn();
    render(<Field label="Map file">{(control) => <FilePicker {...control} onChange={onChange} />}</Field>);
    const input = screen.getByLabelText("Map file");
    expect(screen.getByText("No file chosen")).toBeInTheDocument();
    const file = new File(["x"], "dungeon.png", { type: "image/png" });
    await userEvent.upload(input, file);
    expect(onChange).toHaveBeenCalledWith([file]);
    expect(screen.getByText("dungeon.png")).toBeInTheDocument();
  });

  it("counts several files", async () => {
    render(<FilePicker multiple onChange={() => undefined} aria-describedby={undefined} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, [new File(["a"], "a.png"), new File(["b"], "b.png")]);
    expect(screen.getByText("2 files")).toBeInTheDocument();
  });
});
