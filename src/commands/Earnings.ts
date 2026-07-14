import { CommandInteraction, Client, EmbedBuilder } from 'discord.js';
import { Command } from '../Command';
import { getTotalEarnings, getEarningsByMethod, getTotalTransactionCount } from '../database/payments';

const METHOD_EMOJI: Record<string, string> = {
  PayPal: '🔵',
  Crypto: '🟡',
  Robux: '🟢',
};

function currencySymbol(method: string): string {
  return method === 'Robux' ? 'R$' : '$';
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const Earnings: Command = {
  name: 'earnings',
  description: 'View total revenue and a breakdown by payment method (admin only)',
  options: [],
  run: async (_client: Client, interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;

    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.followUp({
        ephemeral: true,
        content: '❌ You need **Manage Server** permission to use this command.',
      });
      return;
    }

    const guildId = interaction.guildId!;
    const total = getTotalEarnings(guildId);
    const byMethod = getEarningsByMethod(guildId);
    const transactionCount = getTotalTransactionCount(guildId);

    const methodLines =
      byMethod.length > 0
        ? byMethod
            .map(({ method, total: t, count }) => {
              const emoji = METHOD_EMOJI[method] ?? '💳';
              const sym = currencySymbol(method);
              const pct = total > 0 ? ((t / total) * 100).toFixed(1) : '0.0';
              return `${emoji} **${method}** — ${sym}${formatAmount(t)} (${count} transaction${count !== 1 ? 's' : ''}, ${pct}%)`;
            })
            .join('\n')
        : '_No transactions recorded yet._';

    // For the total line, mix of currencies is possible — show raw sum with a note
    const totalLine = `**$${formatAmount(total)}** USD equiv.`;

    const avgLine =
      transactionCount > 0
        ? `$${formatAmount(Math.round((total / transactionCount) * 100) / 100)}`
        : '$0';

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('📊 Earnings Report')
      .addFields(
        { name: '💰 Total Earned', value: totalLine, inline: false },
        {
          name: '🔢 Total Transactions',
          value: `${transactionCount} payment${transactionCount !== 1 ? 's' : ''}`,
          inline: true,
        },
        { name: '📈 Avg. Per Sale', value: avgLine, inline: true },
        { name: '─────────────────', value: '**Breakdown by Method**', inline: false },
        { name: '\u200b', value: methodLines, inline: false },
      )
      .setTimestamp(new Date())
      .setFooter({ text: 'Azero GFX · Revenue Tracker' });

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  },
};
