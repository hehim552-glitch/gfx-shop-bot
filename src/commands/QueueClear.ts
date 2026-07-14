import { CommandInteraction, Client } from 'discord.js';
import { Command } from '../Command';
import db from '../database/database';
import { updateQueueEmbed } from '../queue/queueEmbed';

export const QueueClear: Command = {
  name: 'q-clear',
  description: 'Wipe all entries from the queue and reset the embed',
  run: async (client: Client, interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;

    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.followUp({
        ephemeral: true,
        content: '❌ You need **Manage Server** permission to use this command.',
      });
      return;
    }

    db.prepare('DELETE FROM queue').run();
    db.prepare('DELETE FROM queue_message').run();

    const updated = await updateQueueEmbed(client, interaction.guildId!);

    if (!updated) {
      await interaction.followUp({
        ephemeral: true,
        content: '✅ Queue database cleared, but could not update the embed (check bot permissions in the channel).',
      });
      return;
    }

    await interaction.followUp({
      content: '🗑️ Queue has been fully cleared and the embed has been reset.',
    });
  },
};
