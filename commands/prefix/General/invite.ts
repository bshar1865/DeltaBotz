import { Message } from "discord.js";

export default {
  name: "invite",
  description: "Get the bot invite link.",

  async execute(message: Message) {
    return message.reply({
      content: "Add our bot to your server! - https://discord.com/oauth2/authorize?client_id=1426212984782590023\n\nYou can forward this to your friends to add this bot!",
      allowedMentions: { parse: [] }
    });
  },
};
