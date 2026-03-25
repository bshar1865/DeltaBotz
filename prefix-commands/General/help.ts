import { EmbedBuilder, Message } from "discord.js";
import configManager from "../../utils/ConfigManager";
import { ExtendedClient } from "../../client";

type PrefixCommand = {
  name: string;
  description?: string;
  isModeratorCommand?: boolean;
};

function buildFieldValues(lines: string[], maxLen = 1024): string[] {
  const values: string[] = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxLen) {
      if (current) values.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) values.push(current);
  return values;
}

export default {
  name: "help",
  description: "Lists all general and moderator commands.",

  async execute(message: Message) {
    const client = message.client as ExtendedClient;
    const allCommands: PrefixCommand[] = Array.from(client.prefixCommands.values()).flatMap(cmd => {
      const maybe = cmd as unknown as Partial<PrefixCommand>;
      if (!maybe || typeof maybe.name !== "string") return [];
      return [maybe as PrefixCommand];
    });

    let prefix = ".";
    if (message.guild) {
      const config = await configManager.getOrCreateConfig(message.guild);
      prefix = config.prefix || prefix;
    }

    const generalCommands = allCommands
      .filter(c => !c.isModeratorCommand)
      .sort((a, b) => a.name.localeCompare(b.name));
    const moderatorCommands = allCommands
      .filter(c => c.isModeratorCommand)
      .sort((a, b) => a.name.localeCompare(b.name));

    const format = (c: PrefixCommand) =>
      `\`${prefix}${c.name}\` - ${c.description || "No description provided."}`;

    const generalLines = generalCommands.map(format);
    const moderatorLines = moderatorCommands.map(format);

    const embed = new EmbedBuilder()
      .setTitle("Help")
      .setDescription(`Prefix: \`${prefix}\``)
      .setColor("Random");

    const generalFields = buildFieldValues(generalLines);
    if (generalFields.length === 0) {
      embed.addFields({ name: "General (0)", value: "None" });
    } else {
      generalFields.forEach((value, i) => {
        const label = generalFields.length > 1 ? `General (${generalCommands.length}) ${i + 1}/${generalFields.length}` : `General (${generalCommands.length})`;
        embed.addFields({ name: label, value });
      });
    }

    const modFields = buildFieldValues(moderatorLines);
    if (modFields.length === 0) {
      embed.addFields({ name: "Moderators (0)", value: "None" });
    } else {
      modFields.forEach((value, i) => {
        const label = modFields.length > 1 ? `Moderators (${moderatorCommands.length}) ${i + 1}/${modFields.length}` : `Moderators (${moderatorCommands.length})`;
        embed.addFields({ name: label, value });
      });
    }

    return message.reply({
      embeds: [embed],
      allowedMentions: { parse: [] }
    });
  },
};
