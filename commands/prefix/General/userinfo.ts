import {
    Message,
    EmbedBuilder,
    User,
    Client,
    GuildMember
  } from 'discord.js';
  
  export default {
    name: 'userinfo',
    description: 'Fetches and displays user information, even if they are not in the server.',
    aliases: ['uinfo'],
    
    async execute(message: Message, args: string[], client: Client) {
      const input = args[0];
  
      if (!input) {
        return message.reply('Please provide a user ID or mention.');
      }
  
      const userId = input.replace(/[<@!>]/g, '');
  
      try {
        const user: User = await client.users.fetch(userId);
        const userProfile = await user.fetch();
  
        const embed = new EmbedBuilder()
          .setTitle(`User Information: ${user.username}`)
          .setThumbnail(user.displayAvatarURL({size: 512 }))
          .addFields(
            { name: 'Username', value: user.username, inline: true },
            { name: 'ID', value: user.id, inline: true },
            { name: 'Created At', value: user.createdAt.toDateString(), inline: true }
          );
  
        if (userProfile.banner) {
          const bannerUrl = userProfile.banner.startsWith('a_')
            ? `https://cdn.discordapp.com/banners/${user.id}/${userProfile.banner}.gif?size=512`
            : `https://cdn.discordapp.com/banners/${user.id}/${userProfile.banner}.png?size=512`;
          embed.setImage(bannerUrl);
        }
  
        message.reply({ embeds: [embed] });
  
      } catch (error) {
        console.error(error);
        message.reply('Provide a valid user ID or mention.');
      }
    }
  };
  