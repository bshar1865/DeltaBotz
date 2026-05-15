import { MessageFlags, type StringSelectMenuInteraction } from "discord.js";
import configManager from "../utils/ConfigManager";
import {
  buildAutoModerationEmbed,
  buildGoodbyeEmbed,
  buildHoneypotEmbed,
  buildLoggingEmbed,
  buildMainEmbed,
  buildPermissionsEmbed,
  buildPrefixEmbed,
  buildRoleEmbed,
  buildRoleRestoreEmbed,
  buildWelcomeEmbed,
} from "./embeds";
import {
  buildAutoModerationRows,
  buildGoodbyeRows,
  buildHoneypotRows,
  buildLoggingRows,
  buildMainRows,
  buildPermissionsRows,
  buildPrefixRows,
  buildRoleRestoreRows,
  buildRoleRows,
  buildWelcomeRows,
} from "./rows";

export async function handleSetupMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.guild) return;
  const value = interaction.values[0];
  const config = await configManager.getOrCreateConfig(interaction.guild);

  let embed = buildMainEmbed(config);
  let rows: any[] | undefined = buildMainRows();

  switch (value) {
    case "prefix":
      embed = buildPrefixEmbed(config);
      rows = buildPrefixRows(true);
      break;
    case "roles":
      embed = buildRoleEmbed(config);
      rows = buildRoleRows(true);
      break;
    case "permissions":
      embed = buildPermissionsEmbed(config);
      rows = buildPermissionsRows(true);
      break;
    case "logging":
      embed = buildLoggingEmbed(config);
      rows = buildLoggingRows(true);
      break;
    case "honeypot":
      embed = buildHoneypotEmbed(config);
      rows = buildHoneypotRows(true);
      break;
    case "welcome":
      embed = buildWelcomeEmbed(config);
      rows = buildWelcomeRows(true);
      break;
    case "goodbye":
      embed = buildGoodbyeEmbed(config);
      rows = buildGoodbyeRows(true);
      break;
    case "role_restore":
      embed = buildRoleRestoreEmbed(config);
      rows = buildRoleRestoreRows(true);
      break;
    case "auto_moderation":
      embed = buildAutoModerationEmbed(config);
      rows = buildAutoModerationRows(true);
      break;
    default:
      embed = buildMainEmbed(config);
      rows = buildMainRows();
  }

  try {
    if (rows) await interaction.update({ embeds: [embed], components: rows });
    else await interaction.update({ embeds: [embed] });
  } catch {
    await interaction.followUp({
      content: "Failed to update the setup menu. Please try again.",
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
  }
}
