import type { ActorDto, MemberDto, TokenDto } from "@openvtt/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { AssetPicker } from "../ui/asset-picker";
import { TokenEditor } from "./TokenEditor";
import { TokenList } from "./TokenList";

const goblin: TokenDto = {
  id: "t1",
  sceneId: "s1",
  name: "Goblin",
  x: 0,
  y: 0,
  size: 1,
  rotation: 0,
  color: "#aa3333",
  assetId: null,
  hidden: true,
  actorId: null,
  controllerIds: [],
  hp: null,
  hpMax: null,
  conditions: [],
  showName: false,
};
const hero: TokenDto = { ...goblin, id: "t2", name: "Hero", hidden: false, color: "#3366aa" };
const players: MemberDto[] = [{ userId: "u2", displayName: "Grace", color: "#336699", role: "player", online: true, muted: false }];
const actors: ActorDto[] = [{ id: "a1", type: "npc", name: "Goblin sheet", ownerId: null, data: {} }];

describe("TokenList", () => {
  it("marks the selected token, shows hidden ones and reports selection", async () => {
    const onSelect = vi.fn();
    render(<TokenList tokens={[goblin, hero]} selectedId="t2" onSelect={onSelect} />);

    expect(screen.getByRole("button", { name: /Hero/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Goblin/ })).toHaveTextContent("Hidden");

    await userEvent.click(screen.getByRole("button", { name: /Goblin/ }));
    expect(onSelect).toHaveBeenCalledWith("t1");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<TokenList tokens={[goblin, hero]} selectedId={null} onSelect={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("TokenEditor", () => {
  const setup = (isGm: boolean) => {
    const handlers = { onPatch: vi.fn(), onUpload: vi.fn(), onDelete: vi.fn() };
    const view = render(<TokenEditor token={goblin} players={players} actors={actors} isGm={isGm} {...handlers} />);
    return { ...handlers, ...view };
  };

  it("lets a game master change a switch and a controller", async () => {
    const { onPatch } = setup(true);
    await userEvent.click(screen.getByRole("switch", { name: "Hidden from players" }));
    expect(onPatch).toHaveBeenCalledWith({ hidden: false });

    await userEvent.click(screen.getByRole("checkbox", { name: "Grace" }));
    expect(onPatch).toHaveBeenCalledWith({ controllerIds: ["u2"] });
  });

  it("asks before deleting and only then deletes", async () => {
    const { onDelete } = setup(true);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Delete Goblin?" })).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("shows only rotation to a player who controls the token", () => {
    setup(false);
    expect(screen.getByLabelText("Rotation")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = setup(true);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("AssetPicker", () => {
  it("offers to choose when empty and to change or remove when set", async () => {
    const onRemove = vi.fn();
    const { rerender } = render(<AssetPicker label="Image" assetId={null} name="Goblin" onPick={vi.fn()} onRemove={onRemove} />);
    expect(screen.getByRole("button", { name: "Choose image" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove image" })).toBeNull();

    rerender(<AssetPicker label="Image" assetId="abc" name="Goblin" onPick={vi.fn()} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove image" }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Change image" })).toBeInTheDocument();
  });

  it("passes the chosen file on", async () => {
    const onPick = vi.fn();
    const { container } = render(<AssetPicker label="Image" assetId={null} name="Goblin" onPick={onPick} />);
    const file = new File(["x"], "token.png", { type: "image/png" });
    await userEvent.upload(container.querySelector("input[type=file]")!, file);
    expect(onPick).toHaveBeenCalledWith(file);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<AssetPicker label="Image" assetId={null} name="Goblin" onPick={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
