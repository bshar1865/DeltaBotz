import {
    EmbedBuilder,
    GuildMember,
    Message,
    Client,
  } from 'discord.js';
  
  export default {
    name: 'pfp',
    description: 'Displays the profile picture and banner of a user.',
  
    async execute(message: Message, args: string[]) {
      let member: GuildMember | null = null;
  
      if (args.length) {
        member =
          message.mentions.members?.first() ||
          message.guild?.members.cache.get(args[0]) ||
          message.guild?.members.cache.find(m =>
            m.user.username.toLowerCase().startsWith(args[0].toLowerCase())
          ) || null;
  
        if (!member) {
          return message.reply({
            content: 'User not found.',
            allowedMentions: { parse: [] }
          });
        }
      } else {
        member = message.member;
      }
  
      if (!member) return;
  
      const avatarURL = member.displayAvatarURL({ size: 4096 });
  
      const user = await (message.client as Client).users.fetch(member.id, { force: true });
      const bannerURL = user.bannerURL({ size: 4096 });
  
      const guildBannerURL = member.bannerURL({ size: 4096 });
  
      const avatarEmbed = new EmbedBuilder()
        .setTitle(`${member.displayName}'s Profile Picture`)
        .setImage(avatarURL)
        .setColor(member.displayHexColor || '#ffffff')
        .setAuthor({ name: member.user.tag, iconURL: avatarURL });
  
      await message.reply({
        embeds: [avatarEmbed],
        allowedMentions: { parse: [] }
      });
  
      const bannerToUse = guildBannerURL || bannerURL;
  
      if (bannerToUse) {
        const bannerEmbed = new EmbedBuilder()
          .setTitle(`${member.displayName}'s Banner`)
          .setImage(bannerToUse)
          .setColor(member.displayHexColor || '#ffffff')
          .setAuthor({ name: member.user.tag, iconURL: avatarURL });
  
        await message.reply({
          embeds: [bannerEmbed],
          allowedMentions: { parse: [] }
        });
      }
    },
  };
  