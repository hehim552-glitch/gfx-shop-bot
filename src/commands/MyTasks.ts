import { CommandInteraction, Client, EmbedBuilder } from 'discord.js';
import { Command } from '../Command';
import { getQueue } from '../database/queue';
import { getRewardLabel } from '../database/referrals';

const STATUS_EMOJI: Record<string, string> = {
  waiting: '⏳',
  in_progress: '⚙️',
};

export const MyTasks: Command = {
  name: 'my-tasks',
  description: 'View all active orders in the queue with reward and status details (admin only)',
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

    const entries = getQueue();

    if (entries.length === 0) {
      await interaction.followUp({
        ephemeral: true,
        content: '✅ The queue is currently empty — no active orders.',
      });
      return;
    }

    const inProgress = entries.filter((e) => e.status === 'in_progress');
    const waiting = entries.filter((e) => e.status === 'waiting');

    function formatEntry(e: (typeof entries)[number], index?: number): string {
      const prefix = index !== undefined ? `\`${index + 1}.\`` : `▶️`;
      const reward = getRewardLabel(e.user_id);
      const rewardLine = reward ? `\n    ${reward}` : '';
      return `${prefix} <@${e.user_id}> — ${e.details}${rewardLine}`;
    }

    const inProgressLines =
      inProgress.length > 0
        ? inProgress.map((e) => formatEntry(e)).join('\n\n')
        : '*Nothing in progress*';

    const waitingLines =
      waiting.length > 0
        ? waiting.map((e, i) => formatEntry(e, i)).join('\n\n')
        : '*No orders waiting*';

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📋 My Tasks — Active Order Queue')
      .addFields(
        {
          name: `⚙️ In Progress — ${inProgress.length} order${inProgress.length !== 1 ? 's' : ''}`,
          value: inProgressLines.slice(0, 1024),
        },
        {
          name: `⏳ Waitlist — ${waiting.length} order${waiting.length !== 1 ? 's' : ''}`,
          value: waitingLines.slice(0, 1024),
        },
      )
      .setFooter({
        text: '🎁 = reward to apply on this order  ·  Azero GFX',
      })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  },
};
