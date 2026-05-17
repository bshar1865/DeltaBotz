type Id = string;

export const MESSAGES = {
  common: {
    noPermission: "You do not have permission to use this command.",
    botMissingPermission: (permName: string) => `I need ${permName} permission to do that.`,
    invalidUserId: "Invalid user ID provided. Please make sure the ID is correct.",
    cooldownWait: (seconds: number) => `Please wait ${seconds}s before using this command again.`,
    guildOnly: "This command can only be used in a server.",
  },

  moderation: {
    cannotActionMods: (action: string) => `You cannot ${action} mods <a:AK_KannaPiano:1370142206739877959> `,
    alreadyBanned: "This user is already banned.",
    defaultReason: "No reason provided",
    targetNotFound: "Could not find the specified user in this server.",
    notBanned: "This user is not banned.",

    errors: {
      banFailed: "I was unable to ban the user. Please check the ID and make sure I have permission.",
      kickFailed: "I was unable to kick the user. Please check the ID and make sure the user is still in the server.",
      warnFailed: "I was unable to warn the user. Please check the ID and make sure I have permission.",
      softbanFailed: "I was unable to softban the user. Please check the ID and make sure I have permission.",
      muteFailed: "I was unable to mute the user. Make sure I have permission and the user is valid.",
      unbanFailed: "I was unable to unban the user. Please check the ID and make sure I have permission.",
    },

    guard: {
      self: "You can't moderate yourself. <a:AK_KannaPiano:1370142206739877959>",
      owner: "You can't moderate the server owner. <a:AK_KannaPiano:1370142206739877959>",
      actorHierarchy:
        "You can't moderate a member with an equal or higher role. <a:AK_KannaPiano:1370142206739877959>",
      botHierarchy:
        "I can't moderate that member due to role hierarchy. <a:AK_KannaPiano:1370142206739877959>",
    },

    usage: {
      giver: "Usage: `giver <@user|userID> <roleID1> [roleID2 ...]`",
      remover: "Usage: `remover <@user|userID> <roleID1> [roleID2 ...]`",
      ban: "Please provide a user ID or mention to ban.",
      kick: "Please provide a user ID or mention to kick.",
      warn: "Please provide a user ID or mention to warn.",
      softban: "Please provide a user ID or mention to softban.",
      unban: "Please provide a user ID or mention to unban.",
      muteUser: "Please provide a user ID or mention to mute.",
      muteDuration: "Please provide a duration (e.g., 10s, 5m, 2h, 1d).",
      muteBadDuration: "Invalid duration format. Use s, m, h, or d (e.g., 10s, 5m, 2h, 1d).",
      muteTooLong: "Duration cannot exceed 28d (Discord limit).",
    },

    reply: {
      banned: (userId: Id) => `<@${userId}> has been __**BANNED**__`,
      kicked: (userId: Id) => `<@${userId}> has been __**KICKED**__`,
      softbanned: (userId: Id) => `<@${userId}> has been __**SOFTBANNED**__.`,
      softbanUnbanned: (userId: Id) => `<@${userId}> has been __**UNBANNED**__ (softban completed).`,
      unbanned: (userId: Id) => `<@${userId}> has been __**UNBANNED**__`,
      warned: (userId: Id) => `<@${userId}> has been __**WARNED**__`,
      muted: (userId: Id, duration: string, reason: string) =>
        `<@${userId}> has been __**MUTED**__ for **${duration}** due to: **${reason}**`,
      unmutedLog: (userId: Id, actorId: Id) => `<@${userId}> has been __**UNMUTED**__ by <@${actorId}>`,
    },

    dm: {
      kicked: (guildName: string, reason: string) =>
        `You have been __**KICKED**__ from **${guildName}** for the following reason: ${reason}`,
      banned: (guildName: string, reason: string) =>
        `You have been __**BANNED**__ from **${guildName}** for the following reason: ${reason}`,
      muted: (guildName: string, duration: string, reason: string) =>
        `You have been __**MUTED**__ in **${guildName}** for **${duration}** due to: **${reason}**`,
      muteEnded: (guildName: string) => `Your mute in **${guildName}** has ended.`,
      warned: (guildName: string, reason: string) =>
        `You have been __**WARNED**__ in **${guildName}** for: **${reason}**`,
      softban: (guildName: string, reason: string, inviteUrl?: string | null) => {
        const lines = [
          `Hi, you have been __**SOFTBANNED**__ from **${guildName}** for: ${reason}.`,
          "If your account was hacked or compromised, please secure it (change your password, enable 2FA).",
          "Once you're safe, you're welcome back.",
        ];
        if (inviteUrl) lines.push(`Here's a server invite you can use to rejoin: ${inviteUrl}`);
        return lines.join("\n");
      },
    },

    log: {
      ban: (userId: Id, actorId: Id, reason: string) =>
        `<@${userId}> has been __**BANNED**__ by <@${actorId}> Reason: ${reason}`,
      unban: (userId: Id, actorId: Id, reason: string) =>
        `<@${userId}> has been __**UNBANNED**__ by <@${actorId}> Reason: ${reason}`,
      kick: (userId: Id, actorId: Id, reason: string) =>
        `<@${userId}> has been __**KICKED**__ by <@${actorId}> Reason: ${reason}`,
      mute: (userId: Id, actorId: Id, duration: string, reason: string) =>
        `<@${userId}> has been __**MUTED**__ by <@${actorId}> for **${duration}** due to: **${reason}**`,
      warn: (userId: Id, actorId: Id, reason: string) =>
        `<@${userId}> has been __**WARNED**__ by <@${actorId}> Reason: ${reason}`,
      softban: (userId: Id, actorId: Id, reason: string) =>
        `<@${userId}> has been __**SOFTBANNED**__ by <@${actorId}> Reason: ${reason}`,
      dmFailedBan: (userId: Id) => `Could not send Ban DM to <@${userId}>.`,
      dmFailedSoftban: (userId: Id) => `Could not send Softban DM to <@${userId}>.`,
    },
  },

  purge: {
    invalidAmount: "Please provide a number between 1 and 100 for the amount of messages to delete.",
    deleted: (count: number) =>
      count > 0
        ? `Deleted ${count} message${count === 1 ? '' : 's'}.`
        : 'No messages could be deleted (they may be pinned, older than 14 days, or missing permissions).',
    failed: "I was unable to delete messages. Make sure I have the right permissions.",
    log: (actorId: Id, amount: number, channelId: Id) =>
      `<@${actorId}> has __**PURGED**__ ** ${amount}** messages in <#${channelId}>`,
  },

  roles: {
    targetNotFound: "Could not find the specified user.",
    addedRoles: (targetId: Id, roleNames: string[]) =>
      `Added roles to <@${targetId}>: ${roleNames.join(", ")}`,
    removedRoles: (targetId: Id, roleNames: string[]) =>
      `Removed roles from <@${targetId}>: ${roleNames.join(", ")}`,
    noValidRolesToAdd: "No valid roles to add.",
    noValidRolesToRemove: "No valid roles to remove.",
    invalidOrRestrictedRoleIds: (roleIds: string[]) => `Invalid or restricted role IDs: ${roleIds.join(", ")}`,
    assignError: "An error occurred while assigning roles.",
    removeError: "An error occurred while removing roles.",
    logGiveRole: (targetId: Id, actorId: Id, roleNames: string[]) =>
      `<@${targetId}> has been __**GIVEN**__ the role(s): ${roleNames.join(", ")}`,
    logGiveRoleError: (targetId: Id, actorId: Id) =>
      `<@${targetId}> failed to receive the role(s) from <@${actorId}>`,
    logRemoveRole: (targetId: Id, actorId: Id, roleNames: string[]) =>
      `<@${targetId}> has been __**REMOVED**__ from the role(s): ${roleNames.join(", ")}`,
    logRemoveRoleError: (targetId: Id, actorId: Id) =>
      `<@${targetId}> failed to __**REMOVE**__ the role(s) from <@${actorId}>`,
  },

  copy: {
    copye: {
      noValidInput: "No valid emojis or IDs found in the input.",
      invalidFormat: (input: string) => `Invalid format for \`${input}\``,
      alreadyExists: (name: string) => `Emoji \`${name}\` already exists.`,
      noAnimatedSlots: (name: string) => `Skipped animated emoji \`${name}\` - no animated slots left.`,
      noStaticSlots: (name: string) => `Skipped static emoji \`${name}\` - no static slots left.`,
      addedLine: (animated: boolean, name: string, id: string) => `${animated ? "<a:" : "<:"}${name}:${id}> \`:${name}:\``,
      missingPermissionsToAdd: "Missing permissions to add emojis in this server.",
      rateLimitedPause: "Rate limit hit. Pausing for 15 minutes...",
      rateLimitedWaiting: "Rate limited. Waiting 15 minutes before resuming...",
      rateLimitedResume: "Resuming copying after 15-minute wait.",
      resuming: "Resuming copying.",
      failedToAdd: (name: string) => `Failed to add emoji \`${name}\``,
      summary: (added: number, skipped: number, failed: number) => `Added: ${added} | Skipped: ${skipped} | Failed: ${failed}`,
      logHeader: (actorId: Id) => `**Emoji has been** __**COPIED**__ **by <@${actorId}>**`,
    },
    copys: {
      prompt: "Send a sticker in this channel within 60 seconds.",
    },
  },
} as const;
