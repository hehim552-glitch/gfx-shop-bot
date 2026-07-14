import {
  CommandInteraction,
  Client,
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../Command';
import { recordPayment } from '../database/payments';
import { addToQueue } from '../database/queue';
import { updateQueueEmbed } from '../queue/queueEmbed';
import { updateStatusEmbed } from '../studio/statusEmbed';
import {
  getReferral,
  markReferralCredited,
  incrementPoints,
  getRewardLabel,
  REWARD_LABELS,
} from '../database/referrals';

/**
 * Parse a human-friendly amount string into a number.
 * Accepts: "10k" → 10000, "1.5k" → 1500, "10,000" → 10000, "15.00" → 15
 */
function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '');
  const kMatch = cleaned.match(/^(\d+(\.\d+)?)k$/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1]) * 1000;
    return isFinite(val) && val > 0 ? val : null;
  }
  const val = parseFloat(cleaned);
  return isFinite(val) && val > 0 ? val : null;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function currencySymbol(method: string): string {
  return method === 'Robux' ? 'R$' : '$';
}

export const Paid: Command = {
  name: 'paid',
  description: 'Record a client payment and add them to the order queue',
  options: [
    {
      name: 'client',
      description: 'The client who paid',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'amount',
      description: 'Amount paid — supports shorthand e.g. 10k, 1.5k, or 10000',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'method',
      description: 'Payment method used',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: 'PayPal', value: 'PayPal' },
        { name: 'Crypto', value: 'Crypto' },
        { name: 'Robux', value: 'Robux' },
      ],
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

    const clientUser = interaction.options.getUser('client', true);
    const rawAmount = interaction.options.getString('amount', true);
    const method = interaction.options.getString('method', true);
    const guildId = interaction.guildId!;

    const parsedAmount = parseAmount(rawAmount);
    if (parsedAmount === null) {
      await interaction.followUp({
        ephemeral: true,
        content: `❌ **"${rawAmount}"** isn't a valid amount. Try something like \`15\`, \`1500\`, \`10k\`, or \`1.5k\`.`,
      });
      return;
    }

    const amount = Math.round(parsedAmount * 100) / 100;
    const symbol = currencySymbol(method);
    const displayAmount = `**${symbol}${formatAmount(amount)}**`;

    // ── Save payment ────────────────────────────────────────────────────────────
    recordPayment(guildId, clientUser.id, amount, method);

    // ── Queue ───────────────────────────────────────────────────────────────────
    const addedToQueue = addToQueue(clientUser.id, 'Paid Order');
    const queueUpdated = await updateQueueEmbed(client, guildId);
    updateStatusEmbed(client, guildId).catch((err) =>
      console.error('[Status] Background update failed after /paid:', err?.message ?? err),
    );

    // ── Referral credit ─────────────────────────────────────────────────────────
    let referralNote: string | null = null;
    try {
      const referral = getReferral(clientUser.id);
      if (referral && !referral.credited) {
        markReferralCredited(clientUser.id);
        const newPoints = incrementPoints(referral.referrer_id);
        referralNote = `🔗 Referral point awarded to <@${referral.referrer_id}> — they now have **${newPoints} point${newPoints !== 1 ? 's' : ''}**`;

        // At exactly 3 points, DM the referrer with reward buttons
        if (newPoints === 3) {
          try {
            const referrerUser = await client.users.fetch(referral.referrer_id);
            const rewardEmbed = new EmbedBuilder()
              .setColor(0x9b59b6)
              .setTitle('🎉 You earned a reward!')
              .setDescription(
                "You've hit **3 referral points** — thank you for spreading the word about Azero GFX!\n\nChoose your reward below. It'll be applied automatically to your next order.",
              )
              .addFields(
                { name: '🖼️ Option 1', value: 'Free Icon with Next Thumbnail', inline: true },
                { name: '💸 Option 2', value: '25% Discount on Total Order', inline: true },
              )
              .setFooter({ text: 'Click a button to lock in your choice · Azero GFX' });

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`referral_reward:free_icon:${referrerUser.id}`)
                .setLabel('Free Icon with Next Thumbnail')
                .setEmoji('🖼️')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId(`referral_reward:discount_25:${referrerUser.id}`)
                .setLabel('25% Discount on Total Order')
                .setEmoji('💸')
                .setStyle(ButtonStyle.Secondary),
            );

            await referrerUser.send({ embeds: [rewardEmbed], components: [row] });
            referralNote += ' — **3 points reached!** Reward DM sent 🎁';
          } catch (dmErr: any) {
            console.warn('[Referral] Could not DM referrer for reward:', dmErr?.message ?? dmErr);
            referralNote += ' — **3 points reached!** (Could not DM them — DMs may be off)';
          }
        }
      }
    } catch (refErr: any) {
      console.error('[Referral] Error processing referral credit:', refErr?.message ?? refErr);
    }

    // ── Check if this client has a pending reward to apply ──────────────────────
    const clientReward = getRewardLabel(clientUser.id);

    // ── Build receipt embed ─────────────────────────────────────────────────────
    const methodEmoji: Record<string, string> = {
      PayPal: '🔵',
      Crypto: '🟡',
      Robux: '🟢',
    };

    let queueStatus: string;
    if (!queueUpdated) {
      queueStatus = '⚠️ Added to DB but **could not update the queue embed** — check bot permissions in the order-queue channel.';
    } else if (addedToQueue) {
      queueStatus = '✅ Added to order queue as **Paid Order**';
    } else {
      queueStatus = '⚠️ Already in queue — existing entry kept as-is';
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('💰 Payment Confirmed')
      .setThumbnail(clientUser.displayAvatarURL({ forceStatic: false }))
      .addFields(
        { name: '👤 Client', value: `<@${clientUser.id}>`, inline: true },
        { name: '💵 Amount', value: displayAmount, inline: true },
        { name: `${methodEmoji[method] ?? '💳'} Method`, value: method, inline: true },
      )
      .addFields({ name: '📋 Queue Status', value: queueStatus });

    if (clientReward) {
      embed.addFields({ name: '\u200b', value: clientReward });
    }

    if (referralNote) {
      embed.addFields({ name: '🔗 Referral', value: referralNote });
    }

    embed.setTimestamp(new Date()).setFooter({ text: 'Payment recorded · Azero GFX' });

    await interaction.followUp({ embeds: [embed] });
  },
};
