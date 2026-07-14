import { CommandInteraction, Client } from 'discord.js';
import { Command } from '../Command';
import { buildStatusEmbed, setStatusMessage } from '../studio/statusEmbed';

const STATUS_CHANNEL_ID = '1523955873502986340';

export const SetupStatus: Command = {
  name: 'setup-status',
  description: 'Post the live Studio Status banner into the designated channel (admin only)',
  options: [],
  run: async (client: Client, interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;

    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.followUp({
        ephemeral: true,
        content: '❌ You need **Manage Server** permission to use this command.',
      });
      return;
    }

    const guildId = interaction.guildId!;

    let statusChannel;
    try {
      const fetched = await client.channels.fetch(STATUS_CHANNEL_ID);
      if (!fetched || !fetched.isTextBased()) throw new Error('Not a text channel');
      statusChannel = fetched;
    } catch (err: any) {
      await interaction.followUp({
        ephemeral: true,
        content: `❌ Could not access the status channel (\`${STATUS_CHANNEL_ID}\`). Make sure the bot has **View Channel** and **Send Messages** permissions there.`,
      });
      return;
    }

    const embed = buildStatusEmbed();

    try {
      // @ts-ignore — isTextBased() guarantees send() exists
      const msg = await statusChannel.send({ embeds: [embed] });
      setStatusMessage(guildId, STATUS_CHANNEL_ID, msg.id);

      await interaction.followUp({
        ephemeral: true,
        content: `✅ Studio Status banner posted in <#${STATUS_CHANNEL_ID}>. It will now update automatically whenever an order is added or completed.`,
      });
    } catch (err: any) {
      console.error('[SetupStatus] Failed to send embed:', err?.message ?? err);
      await interaction.followUp({
        ephemeral: true,
        content: '❌ Failed to send the embed. Check the bot has permission to post in that channel.',
      });
    }
  },
};
