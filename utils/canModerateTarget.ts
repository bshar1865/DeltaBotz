import { Guild, GuildMember } from "discord.js";
import { MESSAGES } from "./messages";

export type CanModerateTargetResult =
  | { ok: true }
  | { ok: false; reason: string };

export function canModerateTarget(
  actor: GuildMember,
  target: GuildMember,
  guild: Guild
): CanModerateTargetResult {
  if (actor.id === target.id) {
    return { ok: false, reason: MESSAGES.moderation.guard.self };
  }

  if (target.id === guild.ownerId) {
    return { ok: false, reason: MESSAGES.moderation.guard.owner };
  }

  if (actor.id !== guild.ownerId) {
    if (actor.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
      return { ok: false, reason: MESSAGES.moderation.guard.actorHierarchy };
    }
  }

  const me = guild.members.me;
  if (me && me.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return { ok: false, reason: MESSAGES.moderation.guard.botHierarchy };
  }

  return { ok: true };
}
