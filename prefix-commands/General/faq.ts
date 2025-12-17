import { Message, Client, TextChannel } from 'discord.js';
import configManager from '../../utils/ConfigManager';
import { getGuildDB } from '../../utils/db';

interface FAQEntry {
  name: string;
  content: string;
  creatorId: string;
  creatorTag: string;
  createdAt: string;
  updatedAt: string;
}

// Store pending removals for double confirmation: guildId -> userId -> faqName
const pendingRemovals = new Map<string, Map<string, string>>();

export default {
  name: 'faq',
  description: 'Manage server FAQs. Use `.faq` to list, `.faq add <name> <content>` to add, `.faq remove <name>` to remove, `.faq edit <name> <new content>` to edit, `.faq info <name>` for details.',

  checkPermission(message: Message, config: any): boolean {
    // Owner bypass
    if (message.author.id === config.permissions.ownerId) return true;
    
    // Check if user has any of the required roles
    const allModRoles = config.permissions.moderatorRoles;
    
    return message.member?.roles.cache.some(role => 
      allModRoles.includes(role.id)
    ) || false;
  },

  async execute(message: Message, args: string[], client: Client) {
    if (!message.guild) {
      return message.reply({
        content: 'This command can only be used in a server.',
        allowedMentions: { parse: [] }
      });
    }

    const guildId = message.guild.id;
    const gdb = getGuildDB(guildId);
    const config = await configManager.getOrCreateConfig(message.guild);

    // Get all FAQs
    const getAllFAQs = async (): Promise<FAQEntry[]> => {
      const faqs = await gdb.get<FAQEntry[]>('faqs') || [];
      return faqs;
    };

    // Save all FAQs
    const saveFAQs = async (faqs: FAQEntry[]): Promise<void> => {
      await gdb.set('faqs', faqs);
    };

    // Find FAQ by name (case-insensitive)
    const findFAQ = (faqs: FAQEntry[], name: string): FAQEntry | undefined => {
      return faqs.find(f => f.name.toLowerCase() === name.toLowerCase());
    };

    // No subcommand - list all FAQs
    if (!args[0]) {
      const faqs = await getAllFAQs();
      
      if (faqs.length === 0) {
        return message.reply({
          content: '**Server FAQs**\n\nNo FAQs have been created yet.\n\nModerators can use `.faq add <name> <content>` to create one.',
          allowedMentions: { parse: [] }
        });
      }

      const faqList = faqs.map(faq => faq.name).join(', ');
      return message.reply({
        content: `**Server FAQs**\n\n${faqList}`,
        allowedMentions: { parse: [] }
      });
    }

    const subcommand = args[0].toLowerCase();

    // Add FAQ
    if (subcommand === 'add') {
      const hasPermission = this.checkPermission(message, config);
      if (!hasPermission) {
        return message.reply({
          content: 'You do not have permission to use this command.',
          allowedMentions: { parse: [] }
        });
      }

      if (args.length < 3) {
        return message.reply({
          content: 'Usage: `.faq add <name> <content>`\nExample: `.faq add rules Please follow the server rules!`',
          allowedMentions: { parse: [] }
        });
      }

      const faqName = args[1];
      const faqContent = args.slice(2).join(' ');

      if (faqName.length > 50) {
        return message.reply({
          content: 'FAQ name must be 50 characters or less.',
          allowedMentions: { parse: [] }
        });
      }

      if (faqContent.length > 2000) {
        return message.reply({
          content: 'FAQ content must be 2000 characters or less.',
          allowedMentions: { parse: [] }
        });
      }

      const faqs = await getAllFAQs();
      
      // Check if FAQ already exists
      if (findFAQ(faqs, faqName)) {
        return message.reply({
          content: `A FAQ with the name "${faqName}" already exists. Use \`.faq edit ${faqName} <new content>\` to update it.`,
          allowedMentions: { parse: [] }
        });
      }

      const newFAQ: FAQEntry = {
        name: faqName,
        content: faqContent,
        creatorId: message.author.id,
        creatorTag: message.author.tag,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      faqs.push(newFAQ);
      await saveFAQs(faqs);

      return message.reply({
        content: `**FAQ Added**\n\n**Name:** ${faqName}\n**Content:** ${faqContent}\n\nCreated by ${message.author.tag}`,
        allowedMentions: { parse: [] }
      });
    }

    // Remove FAQ
    if (subcommand === 'remove') {
      const hasPermission = this.checkPermission(message, config);
      if (!hasPermission) {
        return message.reply({
          content: 'You do not have permission to use this command.',
          allowedMentions: { parse: [] }
        });
      }

      if (!args[1]) {
        return message.reply({
          content: 'Usage: `.faq remove <name>`\nExample: `.faq remove rules`',
          allowedMentions: { parse: [] }
        });
      }

      const faqName = args[1];
      const faqs = await getAllFAQs();
      const faq = findFAQ(faqs, faqName);

      if (!faq) {
        return message.reply({
          content: `FAQ "${faqName}" not found.`,
          allowedMentions: { parse: [] }
        });
      }

      // Check for pending removal (double confirmation)
      const guildPending = pendingRemovals.get(guildId) || new Map();
      const pendingName = guildPending.get(message.author.id);

      if (pendingName && pendingName.toLowerCase() === faqName.toLowerCase()) {
        // Second confirmation - actually remove
        const filteredFAQs = faqs.filter(f => f.name.toLowerCase() !== faqName.toLowerCase());
        await saveFAQs(filteredFAQs);
        
        // Clear pending removal
        guildPending.delete(message.author.id);
        if (guildPending.size === 0) {
          pendingRemovals.delete(guildId);
        } else {
          pendingRemovals.set(guildId, guildPending);
        }

        return message.reply({
          content: `**FAQ Removed**\n\n${faqName} has been permanently removed.\n\nRemoved by ${message.author.tag}`,
          allowedMentions: { parse: [] }
        });
      } else {
        // First confirmation - set pending
        guildPending.set(message.author.id, faqName);
        pendingRemovals.set(guildId, guildPending);

        const contentPreview = faq.content.length > 500 ? faq.content.substring(0, 500) + '...' : faq.content;
        return message.reply({
          content: `**Confirm Removal**\n\nAre you sure you want to remove **${faqName}**?\n\n**Content:** ${contentPreview}\n\nRun \`.faq remove ${faqName}\` again to confirm.\n\n⚠️ This action cannot be undone!`,
          allowedMentions: { parse: [] }
        });
      }
    }

    // Edit FAQ
    if (subcommand === 'edit') {
      const hasPermission = this.checkPermission(message, config);
      if (!hasPermission) {
        return message.reply({
          content: 'You do not have permission to use this command.',
          allowedMentions: { parse: [] }
        });
      }

      if (args.length < 3) {
        return message.reply({
          content: 'Usage: `.faq edit <name> <new content>`\nExample: `.faq edit rules Updated server rules!`\n\n⚠️ **Warning:** This replaces the entire FAQ content, not edits it. Make sure to copy the previous content and paste it again with your edits.',
          allowedMentions: { parse: [] }
        });
      }

      const faqName = args[1];
      const newContent = args.slice(2).join(' ');

      if (newContent.length > 2000) {
        return message.reply({
          content: 'FAQ content must be 2000 characters or less.',
          allowedMentions: { parse: [] }
        });
      }

      const faqs = await getAllFAQs();
      const faq = findFAQ(faqs, faqName);

      if (!faq) {
        return message.reply({
          content: `FAQ "${faqName}" not found.`,
          allowedMentions: { parse: [] }
        });
      }

      // Update FAQ
      faq.content = newContent;
      faq.updatedAt = new Date().toISOString();

      await saveFAQs(faqs);

      return message.reply({
        content: `**FAQ Updated**\n\n**Name:** ${faqName}\n**New Content:** ${newContent}\n\n**Original Creator:** ${faq.creatorTag}\n**Last Updated By:** ${message.author.tag}\n\n⚠️ Note: This replaced the entire FAQ content`,
        allowedMentions: { parse: [] }
      });
    }

    // Info about FAQ
    if (subcommand === 'info') {
      if (!args[1]) {
        return message.reply({
          content: 'Usage: `.faq info <name>`\nExample: `.faq info rules`',
          allowedMentions: { parse: [] }
        });
      }

      const faqName = args[1];
      const faqs = await getAllFAQs();
      const faq = findFAQ(faqs, faqName);

      if (!faq) {
        return message.reply({
          content: `FAQ "${faqName}" not found.`,
          allowedMentions: { parse: [] }
        });
      }

      const createdAt = new Date(faq.createdAt);
      const updatedAt = new Date(faq.updatedAt);
      const wasEdited = faq.createdAt !== faq.updatedAt;
      const createdTimestamp = `<t:${Math.floor(createdAt.getTime() / 1000)}:F>`;
      const updatedTimestamp = wasEdited ? `<t:${Math.floor(updatedAt.getTime() / 1000)}:F>` : 'Never';

      return message.reply({
        content: `**FAQ: ${faq.name}**\n\n${faq.content}\n\n**Created By:** <@${faq.creatorId}> (${faq.creatorTag})\n**Created At:** ${createdTimestamp}\n**Last Updated:** ${updatedTimestamp}`,
        allowedMentions: { parse: [] }
      });
    }

    // Check if it's a FAQ name (not a subcommand)
    const faqs = await getAllFAQs();
    const faq = findFAQ(faqs, args[0]);
    
    if (faq) {
      // Display the FAQ content directly
      return message.reply({
        content: faq.content,
        allowedMentions: { parse: [] }
      });
    }

    // Invalid subcommand
    return message.reply({
      content: 'This FAQ likely does not exist, use `.faq` to list FAQs.',
      allowedMentions: { parse: [] }
    });
  }
};

