import { Guild, TextChannel, ChannelType, Collection, Message } from 'discord.js';

/**
 * Deletes all messages from a user in all channels within the last 1 day (24 hours)
 * @param guild - The Discord guild
 * @param userId - The user ID whose messages to delete
 * @returns Promise<number> - Number of messages deleted
 */
export async function deleteUserMessagesLastDay(guild: Guild, userId: string): Promise<number> {
  let totalDeleted = 0;
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000); // 1 day in milliseconds

  try {
    // Get all text channels in the guild
    const channels = guild.channels.cache.filter(
      channel => channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement
    ) as Collection<string, TextChannel>;

    // Process each channel
    for (const [, channel] of channels) {
      try {
        // Check if bot has permission to manage messages in this channel
        const me = guild.members.me;
        if (!me || !me.permissionsIn(channel).has('ManageMessages')) {
          continue; // Skip channels where bot doesn't have permission
        }

        // Fetch messages from the channel (up to 100 at a time)
        let lastMessageId: string | undefined;
        let hasMore = true;
        const messagesToDelete: Message[] = [];

        while (hasMore && messagesToDelete.length < 1000) { // Limit to prevent excessive API calls
          const fetchOptions: any = { limit: 100 };
          if (lastMessageId) {
            fetchOptions.before = lastMessageId;
          }

          const messages = await channel.messages.fetch(fetchOptions);
          
          // Type assertion - messages.fetch() returns Collection<string, Message>
          const messagesCollection = messages as unknown as Collection<string, Message>;
          
          // Convert to array for easier handling
          const messagesArray = Array.from(messagesCollection.values());
          
          if (messagesArray.length === 0) {
            hasMore = false;
            break;
          }

          // Filter messages from the user within the last day
          let oldestTimestamp = Date.now();
          for (const msg of messagesArray) {
            if (msg.author.id === userId && msg.createdTimestamp >= oneDayAgo) {
              messagesToDelete.push(msg);
            }
            
            // Track oldest message for pagination
            if (msg.createdTimestamp < oldestTimestamp) {
              oldestTimestamp = msg.createdTimestamp;
              lastMessageId = msg.id;
            }
          }

          // If the oldest message is older than 1 day, stop fetching
          if (oldestTimestamp < oneDayAgo) {
            hasMore = false;
          }

          // If we got less than 100 messages, we've reached the end
          if (messagesArray.length < 100) {
            hasMore = false;
          }
        }

        // Delete messages in batches (Discord allows bulk delete of up to 100 messages at a time)
        // Messages must be less than 14 days old for bulk delete
        const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
        const bulkDeleteMessages = messagesToDelete.filter(msg => msg.createdTimestamp >= fourteenDaysAgo);
        const individualDeleteMessages = messagesToDelete.filter(msg => msg.createdTimestamp < fourteenDaysAgo);

        // Bulk delete messages (up to 100 at a time)
        for (let i = 0; i < bulkDeleteMessages.length; i += 100) {
          const batch = bulkDeleteMessages.slice(i, i + 100);
          try {
            await channel.bulkDelete(batch, true);
            totalDeleted += batch.length;
          } catch (error) {
            console.error(`Error bulk deleting messages in channel ${channel.id}:`, error);
            // Fall back to individual deletion for this batch
            for (const msg of batch) {
              try {
                await msg.delete();
                totalDeleted++;
              } catch (err) {
                // Message might already be deleted or inaccessible
              }
            }
          }
        }

        // Delete older messages individually (if they're between 1 day and 14 days old)
        for (const msg of individualDeleteMessages) {
          try {
            await msg.delete();
            totalDeleted++;
          } catch (error) {
            // Message might already be deleted or inaccessible
          }
        }

      } catch (error) {
        console.error(`Error processing channel ${channel.id}:`, error);
        // Continue with other channels
      }
    }
  } catch (error) {
    console.error(`Error deleting messages for user ${userId}:`, error);
  }

  return totalDeleted;
}
