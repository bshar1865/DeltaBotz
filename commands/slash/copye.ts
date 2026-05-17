import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Guild,
  TextChannel,
  GuildMember,
  PermissionFlagsBits
} from 'discord.js';
import configManager from '../../utils/ConfigManager';
import { hasModAccess } from '../../utils/permissions';
import { MESSAGES } from '../../utils/messages';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function addEmojisWithPause(guild: Guild, emojiData: string[], interaction: ChatInputCommandInteraction) {
  const addedEmojis = new Set(guild.emojis.cache.map(e => e.name));
  const logLines: string[] = [];

  const totalEmojiLimit = guild.premiumTier >= 2 ? 250 : guild.premiumTier === 1 ? 150 : 50;

  let remainingStatic = totalEmojiLimit - guild.emojis.cache.filter(e => !e.animated).size;
  let remainingAnimated = totalEmojiLimit - guild.emojis.cache.filter(e => e.animated).size;

  let added = 0, failed = 0, skipped = 0, index = 0;

  while (index < emojiData.length) {
    const emojiInput = emojiData[index];
    let nameFromUrl: string;
    let emojiId: string;
    let isAnimated = false;

    const match = emojiInput.match(/<(a?):(\w+):(\d+)>/);
    if (match) {
      isAnimated = match[1] === 'a';
      nameFromUrl = match[2];
      emojiId = match[3];
    } else if (/^\d+$/.test(emojiInput)) {
      emojiId = emojiInput;
      nameFromUrl = `emoji_${emojiId}`;
    } else {
      logLines.push(MESSAGES.copy.copye.invalidFormat(emojiInput));
      failed++;
      index++;
      continue;
    }

    if (addedEmojis.has(nameFromUrl)) {
      logLines.push(MESSAGES.copy.copye.alreadyExists(nameFromUrl));
      skipped++;
      index++;
      continue;
    }

    if (isAnimated && remainingAnimated <= 0) {
      logLines.push(MESSAGES.copy.copye.noAnimatedSlots(nameFromUrl));
      skipped++;
      index++;
      continue;
    }

    if (!isAnimated && remainingStatic <= 0) {
      logLines.push(MESSAGES.copy.copye.noStaticSlots(nameFromUrl));
      skipped++;
      index++;
      continue;
    }

    try {
      const extension = isAnimated ? 'gif' : 'png';
      const emoji = await guild.emojis.create({
        attachment: `https://cdn.discordapp.com/emojis/${emojiId}.${extension}`,
        name: nameFromUrl
      });

      logLines.push(MESSAGES.copy.copye.addedLine(isAnimated, emoji.name, emoji.id));
      isAnimated ? remainingAnimated-- : remainingStatic--;
      added++;
    } catch (error: any) {
      failed++;

      if (error.code === 50013) {
        logLines.push(MESSAGES.copy.copye.missingPermissionsToAdd);
      } else if (
        error.message?.includes("rate limited") ||
        error.code === 20028 // Rate limit
      ) {
        logLines.push(MESSAGES.copy.copye.rateLimitedPause);
        await interaction.followUp({
          content: MESSAGES.copy.copye.rateLimitedWaiting,
          ephemeral: false
        });

        await sleep(15 * 60 * 1000);

        logLines.push(MESSAGES.copy.copye.resuming);
        await interaction.followUp({
          content: MESSAGES.copy.copye.rateLimitedResume,
          ephemeral: false
        });

        continue;
      } else {
        logLines.push(MESSAGES.copy.copye.failedToAdd(nameFromUrl));
      }
    }

    index++;
  }

  logLines.unshift(MESSAGES.copy.copye.summary(added, skipped, failed));

  const chunks: string[] = [];
  let chunk = '';
  for (const line of logLines) {
    if (chunk.length + line.length + 1 > 2000) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += line + '\n';
  }
  if (chunk) chunks.push(chunk);

  return chunks;
}

export const data = new SlashCommandBuilder()
  .setName('copye')
  .setDescription('Copies emojis to this server')
  .addStringOption(option =>
    option.setName('emoji_list')
      .setDescription('Emoji mentions or Emoji IDs')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  const config = await configManager.getOrCreateConfig(interaction.guild!);
  const hasPermission = hasModAccess(
    member,
    interaction.user.id,
    config,
    [PermissionFlagsBits.ManageEmojisAndStickers]
  );

  if (!hasPermission) {
    return interaction.reply({
      content: MESSAGES.common.noPermission,
      ephemeral: true
    });
  }

  const emojiString = interaction.options.getString('emoji_list', true);
  const emojiMentions = emojiString.match(/<a?:\w+:\d+>/g) || [];
  const rawIds = emojiString.match(/\b\d{17,20}\b/g) || [];

  const processedIds = new Set<string>();
  const emojiArray: string[] = [];

  for (const mention of emojiMentions) {
    const match = mention.match(/<a?:(\w+):(\d+)>/);
    if (match) {
      const id = match[2];
      if (!processedIds.has(id)) {
        emojiArray.push(mention);
        processedIds.add(id);
      }
    }
  }

  for (const id of rawIds) {
    if (!processedIds.has(id)) {
      emojiArray.push(id);
      processedIds.add(id);
    }
  }

  if (emojiArray.length === 0) {
    return interaction.reply({
      content: MESSAGES.copy.copye.noValidInput,
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: false });

  const logs = await addEmojisWithPause(interaction.guild!, emojiArray, interaction);

  for (const chunk of logs) {
    await interaction.followUp({ content: chunk, ephemeral: false });
  }

  const logChannelId = config.logging.logChannelId || '';
  if (logChannelId) {
    const logChannel = interaction.guild?.channels.cache.get(logChannelId) as TextChannel;
    if (logChannel) {
      for (const chunk of logs) {
        await logChannel.send({
          content: `${MESSAGES.copy.copye.logHeader(interaction.user.id)}\n${chunk}`,
          allowedMentions: { parse: [] }
        });
      }
    }
  }
}

export default {
  data,
  execute
};

