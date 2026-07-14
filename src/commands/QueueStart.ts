import { CommandInteraction, Client, ApplicationCommandOptionType } from 'discord.js';
import { Command } from '../Command';
import { startQueue } from '../database/queue';
import { updateQueueEmbed } from '../queue/queueEmbed';

export const QueueStart: Command = {
  name: 'q-start',
  description: 'Move a queued user from the waitlist to In Progress',
  options: [
    {
      name: 'user',
      description: 'The user whose order you are starting',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  run: async (client: Client, interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;

    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.followUp({
        ephemeral: true,
        content: '❌ You need **Manage Server** permission to use this command.',
      });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const guildId = interaction.guildId!;
    const moved = startQueue(user.id);

    if (!moved) {
      await interaction.followUp({
        ephemeral: true,
        content: `⚠️ <@${user.id}> is not currently in the waitlist.`,
      });
      return;
    }

    const updated = await updateQueueEmbed(client, guildId);
    if (!updated) {
      await interaction.followUp({
        ephemeral: true,
        content: '⚠️ Status updated but could not find the **order-queue** channel to update the embed.',
      });
      return;
    }

    await interaction.followUp({
      content: `▶️ Started order for <@${user.id}> — moved to **In Progress**.`,
    });
  },
};
