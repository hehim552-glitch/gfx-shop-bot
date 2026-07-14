import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { getQueue, getQueueMessage, setQueueMessage } from '../database/queue';

const POSITION_EMOJIS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

function buildQueueEmbed(): EmbedBuilder {
  const entries = getQueue();
  const waiting = entries.filter((e) => e.status === 'waiting');
  const inProgress = entries.filter((e) => e.status === 'in_progress');

  const rawWaitlist =
    waiting.length === 0
      ? '*No orders waiting*'
      : waiting
          .map((e, i) => {
            const bullet = POSITION_EMOJIS[i] ?? `${i + 1}.`;
            return `${bullet} <@${e.user_id}> — ${e.details}`;
          })
          .join('\n');

  const rawInProgress =
    inProgress.length === 0
      ? '*Nothing in progress*'
      : inProgress.map((e) => `▶️ <@${e.user_id}> — ${e.details}`).join('\n');

  const waitlistValue = truncate(rawWaitlist);
  const inProgressValue = truncate(rawInProgress);

  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🚥 GFX Order Queue')
    .addFields(
      {
        name: `📋 Waitlist — ${waiting.length} order${waiting.length !== 1 ? 's' : ''}`,
        value: waitlistValue,
      },
      {
        name: `⚙️ In Progress — ${inProgress.length} order${inProgress.length !== 1 ? 's' : ''}`,
        value: inProgressValue,
      },
    )
    .setFooter({ text: 'Last updated' })
    .setTimestamp();
}

const MAX_FIELD_LENGTH = 1024;

function truncate(value: string): string {
  if (value.length <= MAX_FIELD_LENGTH) return value;
  return value.slice(0, MAX_FIELD_LENGTH - 3) + '...';
}

const QUEUE_CHANNEL_ID = '1523773021976924361';

async function findQueueChannel(client: Client): Promise<TextChannel | null> {
  try {
    const channel = await client.channels.fetch(QUEUE_CHANNEL_ID);
    if (channel && channel.isTextBased()) return channel as TextChannel;
  } catch (error: any) {
    console.error('[Queue] Could not fetch channel', QUEUE_CHANNEL_ID, ':', error?.message ?? error);
  }
  return null;
}

/**
 * Finds the queue channel in the given guild, edits the stored embed message
 * (or posts a new one if missing), and returns true on success.
 */
export async function updateQueueEmbed(
  client: Client,
  guildId: string,
): Promise<boolean> {
  const queueChannel = await findQueueChannel(client);
  if (!queueChannel) {
    console.error('[Queue] Could not find an order-queue channel in guild', guildId);
    return false;
  }

  const embed = buildQueueEmbed();
  const stored = getQueueMessage(guildId);

  // Try to edit the existing embed
  if (stored && stored.channel_id === queueChannel.id) {
    try {
      const msg = await queueChannel.messages.fetch(stored.message_id);
      await msg.edit({ embeds: [embed] });
      return true;
    } catch (error: any) {
      // 10008 = Unknown Message (deleted) — safe to post a new one
      // Anything else (e.g. 50013 Missing Permissions) — surface it, don't retry
      if (error?.code !== 10008) {
        console.error('[Queue] Failed to edit embed:', error?.message ?? error);
        return false;
      }
      // Message was deleted — fall through and post a fresh one
    }
  }

  try {
    const newMsg = await queueChannel.send({ embeds: [embed] });
    setQueueMessage(guildId, queueChannel.id, newMsg.id);
    return true;
  } catch (error: any) {
    console.error('[Queue] Failed to send embed to', queueChannel.name, ':', error?.message ?? error);
    return false;
  }
}
