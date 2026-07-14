import { CommandInteraction, Client, ApplicationCommandOptionType } from 'discord.js';
import { Command } from '../Command';
import { addToQueue } from '../database/queue';
import { updateQueueEmbed } from '../queue/queueEmbed';
import { updateStatusEmbed } from '../studio/statusEmbed';

export const QueueAdd: Command = {
  name: 'q-add',
  description: 'Add a user to the GFX order queue',
  options: [
    {
      name: 'user',
      description: 'The user to add',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'details',
      description: 'Order details (e.g. "banner, dark theme")',
      type: ApplicationCommandOptionType.String,
      required: true,
      min_length: 3,
      max_length: 100,
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
    const details = interaction.options.getString('details', true);
    const guildId = interaction.guildId!;

    const added = addToQueue(user.id, details);
    if (!added) {
      await interaction.followUp({
        ephemeral: true,
        content: `⚠️ <@${user.id}> is already in the queue.`,
      });
      return;
    }

    const updated = await updateQueueEmbed(client, guildId);
    if (!updated) {
      await interaction.followUp({
        ephemeral: true,
        content: '⚠️ Added to the database but could not find the **order-queue** channel to update the embed.',
      });
      return;
    }

    // Fire-and-forget — status banner updates silently in the background
    updateStatusEmbed(client, guildId).catch((err) =>
      console.error('[Status] Background update failed after q-add:', err?.message ?? err),
    );

    await interaction.followUp({
      content: `✅ Added <@${user.id}> to the queue — *${details}*`,
    });
  },
};
