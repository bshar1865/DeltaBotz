import { GuildMember, PermissionResolvable, PermissionsBitField } from "discord.js";

export function hasAnyPermission(
  member: GuildMember | null | undefined,
  permissions: PermissionResolvable[] | undefined
): boolean {
  if (!member || !permissions || permissions.length === 0) return false;
  return permissions.some(permission => member.permissions.has(permission));
}

export function isAdmin(member: GuildMember | null | undefined): boolean {
  return Boolean(member?.permissions.has(PermissionsBitField.Flags.Administrator));
}

export function hasModAccess(
  member: GuildMember | null | undefined,
  userId: string,
  config: any,
  requiredPermissions?: PermissionResolvable[]
): boolean {
  if (!member) return false;

  if (isAdmin(member)) return true;

  const botOwnerId = process.env.BOT_OWNER_ID || process.env.OWNER_ID || "";
  const isOwner =
    userId === config.permissions.ownerId ||
    (botOwnerId ? userId === botOwnerId : false);
  if (isOwner) return true;

  if (hasAnyPermission(member, requiredPermissions)) return true;

  const modRoles: string[] = config.permissions.moderatorRoles || [];
  return member.roles.cache.some(role => modRoles.includes(role.id));
}
