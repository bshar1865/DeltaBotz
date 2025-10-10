import { Client, Events, ActivityType } from 'discord.js';

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client: Client<true>) {
        client.user.setActivity('DeltaBotz', {
            type: ActivityType.Watching
        });
    }
};
