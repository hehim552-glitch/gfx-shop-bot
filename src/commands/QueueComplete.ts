import { CommandInteraction, Client, ApplicationCommandOptionType } from 'discord.js';
import { Command } from '../Command';
import { completeQueue } from '../database/queue';
import { updateQueueEmbed } from '../queue/queueEmbed';
import { updateStatusEmbed } from '../studio/statusEmbed';
import { clearClaimedReward } from '../database/referrals';

export const QueueComplete: Command = {
  name: 'q-complete',
  description: "Mark a user's order as complete and remove them from the queue",
  options: [
    {
      name: 'user',
      description: 'The user whose order is complete',
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

    // Send the client a DM before removing them from the queue
    try {
      await user.send(
        "Hey! Your order is complete! 🎉 If you're happy with the GFX, please drop a review in our vouches channel using the `/vouch` command — it means a lot! 🙏",
      );
    } catch {
      // User may have DMs disabled — continue regardless
      console.warn(`[Queue] Could not DM user ${user.id} — DMs may be disabled.`);
    }

    const removed = completeQueue(user.id);

    if (!removed) {
      await interaction.followUp({
        ephemeral: true,
        content: `⚠️ <@${user.id}> is not currently in the queue.`,
      });
      return;
    }

    const updated = await updateQueueEmbed(client, guildId);
    if (!updated) {
      await interaction.followUp({
        ephemeral: true,
        content: '⚠️ Removed from the database but could not find the **order-queue** channel to update the embed.',
      });
      return;
    }

    // Fire-and-forget — status banner updates silently in the background
    updateStatusEmbed(client, guildId).catch((err) =>
      console.error('[Status] Background update failed after q-complete:', err?.message ?? err),
    );

    // Clear any claimed referral reward now that the order is done
    clearClaimedReward(user.id);

    await interaction.followUp({
      content: `✅ Order complete for <@${user.id}> — removed from queue. A review prompt has been sent to their DMs.`,
    });
  },
};
