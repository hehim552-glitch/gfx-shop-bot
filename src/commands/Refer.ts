import { CommandInteraction, Client, ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { Command } from '../Command';
import { logReferral } from '../database/referrals';

export const Refer: Command = {
  name: 'refer',
  description: 'Log that you were referred by another member of the server',
  options: [
    {
      name: 'user',
      description: 'The member who referred you',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  run: async (_client: Client, interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;

    const referrer = interaction.options.getUser('user', true);
    const client_id = interaction.user.id;
    const referrer_id = referrer.id;

    const result = logReferral(client_id, referrer_id);

    if (result === 'self') {
      await interaction.followUp({
        ephemeral: true,
        content: "❌ You can't refer yourself.",
      });
      return;
    }

    if (result === 'duplicate') {
      await interaction.followUp({
        ephemeral: true,
        content: '❌ You already have a referral logged. Each client can only be referred once.',
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('🤝 Referral Logged')
      .setDescription(
        `Thanks for letting us know! Your referral has been saved.\n\nWhen your order payment clears, <@${referrer_id}> will earn a **Referral Point** automatically.`,
      )
      .addFields(
        { name: '👤 Client', value: `<@${client_id}>`, inline: true },
        { name: '🔗 Referred By', value: `<@${referrer_id}>`, inline: true },
      )
      .setFooter({ text: 'Referral points are credited on payment confirmation · Azero GFX' })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
  },
};
