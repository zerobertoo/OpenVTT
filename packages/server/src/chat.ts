import { randomInt, randomUUID } from "node:crypto";
import { DiceError, type RollResult, rollDice } from "@openvtt/sdk";
import type { MessageDto, MessageKind } from "@openvtt/shared";
import type { Db } from "./db.ts";
import { AppError } from "./errors.ts";
import type { Viewer } from "./tokens.ts";

const HISTORY_LIMIT = 100;
const ROLL_COMMAND = /^\/(r|roll|gr|gmroll)\s+(.+)$/i;

interface MessageRow {
  id: string;
  user_id: string;
  sender_name: string;
  kind: MessageKind;
  to_user_id: string | null;
  gm_only: number;
  content: string;
  roll: string | null;
  created_at: number;
}

const toDto = (r: MessageRow): MessageDto => ({
  id: r.id,
  userId: r.user_id,
  senderName: r.sender_name,
  kind: r.kind,
  toUserId: r.to_user_id,
  gmOnly: r.gm_only === 1,
  content: r.content,
  roll: r.roll ? (JSON.parse(r.roll) as RollResult) : null,
  createdAt: r.created_at,
});

/** The GM reads everything; others read public messages plus those they sent or received. */
export function canReadMessage(message: MessageDto, viewer: Viewer): boolean {
  if (viewer.role === "gm" || message.userId === viewer.userId) return true;
  if (message.gmOnly) return false;
  return message.toUserId === null || message.toUserId === viewer.userId;
}

export class ChatService {
  constructor(private db: Db) {}

  /** `/r 2d6+3` becomes a roll (`/gr` a private one); anything else is chat (or a whisper when `toUserId` is set). */
  send(
    worldId: string,
    sender: { userId: string; displayName: string; role: Viewer["role"] },
    input: { content: string; toUserId: string | null; gmOnly: boolean },
  ): MessageDto {
    if (input.toUserId !== null) {
      const recipient = this.db.prepare("SELECT role FROM members WHERE world_id = ? AND user_id = ?").get(worldId, input.toUserId) as
        | { role: Viewer["role"] }
        | undefined;
      if (!recipient) throw new AppError("not_found");
      // Whispers are GM ↔ player only (PRD 6.4).
      if (sender.role !== "gm" && recipient.role !== "gm") throw new AppError("forbidden");
    }

    const rollMatch = ROLL_COMMAND.exec(input.content);
    let roll: RollResult | null = null;
    let kind: MessageKind = input.toUserId ? "whisper" : "chat";
    if (rollMatch) {
      try {
        roll = rollDice(rollMatch[2]!, (sides) => randomInt(1, sides + 1));
      } catch (error) {
        if (error instanceof DiceError) throw new AppError("roll_invalid");
        throw error;
      }
      kind = "roll";
    }

    const message: MessageDto = {
      id: randomUUID(),
      userId: sender.userId,
      senderName: sender.displayName,
      kind,
      toUserId: input.toUserId,
      // /gr is a roll only the game master and the roller can read.
      gmOnly: input.gmOnly || (rollMatch?.[1]?.toLowerCase().startsWith("g") ?? false),
      content: input.content,
      roll,
      createdAt: Date.now(),
    };
    this.db
      .prepare(
        `INSERT INTO messages (id, world_id, user_id, sender_name, kind, to_user_id, gm_only, content, roll, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.id,
        worldId,
        message.userId,
        message.senderName,
        kind,
        message.toUserId,
        message.gmOnly ? 1 : 0,
        message.content,
        roll ? JSON.stringify(roll) : null,
        message.createdAt,
      );
    return message;
  }

  /** The whole conversation the viewer may read, as markdown. */
  logFor(worldId: string, worldName: string, viewer: Viewer): string {
    const rows = this.db
      .prepare("SELECT * FROM messages WHERE world_id = ? ORDER BY created_at, rowid")
      .all(worldId) as unknown as MessageRow[];
    const lines = [`# ${worldName}`, ""];
    for (const message of rows.map(toDto)) {
      if (!canReadMessage(message, viewer)) continue;
      const time = new Date(message.createdAt).toISOString().slice(0, 16).replace("T", " ");
      const flags = [message.kind === "whisper" && "whisper", message.gmOnly && "gm"].filter(Boolean);
      const result = message.roll ? ` = **${message.roll.total}**` : "";
      lines.push(
        `- ${time} **${message.senderName}**${flags.length ? ` (${flags.join(", ")})` : ""}: ${message.content.replace(/\s*\n\s*/g, " ")}${result}`,
      );
    }
    return `${lines.join("\n")}\n`;
  }

  /** Latest messages the viewer may read, oldest first. */
  historyFor(worldId: string, viewer: Viewer): MessageDto[] {
    const rows = this.db
      .prepare("SELECT * FROM messages WHERE world_id = ? ORDER BY created_at DESC, rowid DESC")
      .all(worldId) as unknown as MessageRow[];
    const visible: MessageDto[] = [];
    for (const row of rows) {
      const message = toDto(row);
      if (canReadMessage(message, viewer)) visible.push(message);
      if (visible.length === HISTORY_LIMIT) break;
    }
    return visible.reverse();
  }
}
