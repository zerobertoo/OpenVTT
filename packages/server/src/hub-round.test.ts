import type { ServerMessage, TokenDto } from "@openvtt/shared";
import { afterEach, expect, it } from "vitest";
import { call, closeApps, connect, listen, newApp, signUp } from "./test-utils.ts";

afterEach(closeApps);

const isState = (m: ServerMessage): m is Extract<ServerMessage, { type: "world.state" }> => m.type === "world.state";

/** Bob and Carol stand on either side of a wall, each with a monster on their own side. */
async function setup() {
  const app = newApp();
  const gm = await signUp(app, "alice");
  const bob = await signUp(app, "bob");
  const carol = await signUp(app, "carol");
  const world = (await call(app, gm.cookie, "POST", "/api/worlds", { name: "Table" })).json();
  const { code } = (await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/invites`)).json();
  for (const player of [bob, carol])
    await call(app, player.cookie, "POST", `/api/invites/${code}/join`, { displayName: player.user.username, color: "#112233" });
  const scene = (
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/scenes`, {
      name: "Split",
      width: 2000,
      height: 1000,
      visionEnabled: true,
      visionRadius: 30,
      walls: [{ x1: 1000, y1: 0, x2: 1000, y2: 1000 }],
    })
  ).json();
  const token = async (name: string, x: number, controllerIds: string[] = []) =>
    (
      await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, { sceneId: scene.id, name, x, y: 500, controllerIds })
    ).json() as TokenDto;
  await token("Bob", 300, [bob.user.id]);
  await token("Carol", 1700, [carol.user.id]);
  const leftMonster = await token("Left monster", 400);
  await token("Right monster", 1600);
  return { app, gm, bob, carol, world, leftMonster, port: await listen(app) };
}

it("works out sight separately for each player in the same broadcast", async () => {
  const { app, gm, bob, carol, world, port } = await setup();
  const bobSocket = connect(port, world.id, bob.cookie);
  const carolSocket = connect(port, world.id, carol.cookie);
  const gmSocket = connect(port, world.id, gm.cookie);
  await Promise.all([bobSocket.opened, carolSocket.opened, gmSocket.opened]);
  for (const socket of [bobSocket, carolSocket, gmSocket]) await socket.settle();
  for (const socket of [bobSocket, carolSocket, gmSocket]) socket.seen.length = 0;

  await call(app, gm.cookie, "PATCH", `/api/worlds/${world.id}`, { name: "Renamed" });
  const namesFor = async (socket: typeof bobSocket) => (await socket.waitFor(isState)).state.tokens.map((t) => t.name).sort();

  expect(await namesFor(bobSocket)).toEqual(["Bob", "Left monster"]);
  expect(await namesFor(carolSocket)).toEqual(["Carol", "Right monster"]);
  expect(await namesFor(gmSocket)).toEqual(["Bob", "Carol", "Left monster", "Right monster"]);
  for (const socket of [bobSocket, carolSocket, gmSocket]) socket.ws.close();
});

it("tells each player about a token move according to their own sight", async () => {
  const { app, gm, bob, carol, world, leftMonster, port } = await setup();
  const bobSocket = connect(port, world.id, bob.cookie);
  const carolSocket = connect(port, world.id, carol.cookie);
  await Promise.all([bobSocket.opened, carolSocket.opened]);
  for (const socket of [bobSocket, carolSocket]) await socket.settle();
  for (const socket of [bobSocket, carolSocket]) socket.seen.length = 0;

  await call(app, gm.cookie, "PATCH", `/api/tokens/${leftMonster.id}`, { x: 450 });
  await bobSocket.waitFor((m) => m.type === "token.upsert" && m.token.id === leftMonster.id);
  await carolSocket.settle();
  expect(JSON.stringify(carolSocket.seen)).not.toContain(leftMonster.id);
  for (const socket of [bobSocket, carolSocket]) socket.ws.close();
});

it("tells the sender where a token really is when a move is refused because control was taken away", async () => {
  const { app, gm, bob, world, leftMonster, port } = await setup();
  const token = (
    await call(app, gm.cookie, "POST", `/api/worlds/${world.id}/tokens`, {
      sceneId: leftMonster.sceneId,
      name: "Borrowed",
      x: 350,
      y: 500,
      controllerIds: [bob.user.id],
    })
  ).json() as TokenDto;
  const socket = connect(port, world.id, bob.cookie);
  await socket.opened;
  await socket.settle();
  await call(app, gm.cookie, "PATCH", `/api/tokens/${token.id}`, { controllerIds: [] });
  await socket.settle();
  socket.seen.length = 0;

  socket.ws.send(JSON.stringify({ type: "token.move", tokenId: token.id, x: 500, y: 500 }));
  await socket.waitFor((m) => m.type === "error" && m.code === "forbidden");
  expect(socket.seen.find((m) => m.type === "token.upsert")).toMatchObject({ token: { id: token.id, x: 350, y: 500 } });
  socket.ws.close();
});
