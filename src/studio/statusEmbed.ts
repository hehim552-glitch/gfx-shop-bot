import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { getQueue } from '../database/queue';
import db from '../database/database';

const STATUS_CHANNEL_ID = '1523955873502986340';

// ── DB helpers ────────────────────────────────────────────────────────────────

interface StatusMessageRow {
  channel_id: string;
  message_id: string;
}

export function getStatusMessage(guild_id: string): StatusMessageRow | null {
  return (
    (db
      .prepare('SELECT channel_id, message_id FROM status_message WHERE guild_id = ?')
      .get(guild_id) as StatusMessageRow | undefined) ?? null
  );
}

export function setStatusMessage(guild_id: string, channel_id: string, message_id: string): void {
  db.prepare(
    'INSERT OR REPLACE INTO status_message (guild_id, channel_id, message_id) VALUES (?, ?, ?)',
  ).run(guild_id, channel_id, message_id);
}

// ── Embed builder ─────────────────────────────────────────────────────────────

export function buildStatusEmbed(): EmbedBuilder {
  const entries = getQueue();
  const activeCount = entries.length;
  const isOpen = activeCount < 5;

  const statusLine = isOpen
    ? '🟢  **Open** — accepting orders'
    : '🟡  **Busy** — queue near capacity';

  const workloadBar = buildWorkloadBar(activeCount);
  const nowUnix = Math.floor(Date.now() / 1000);

  return new EmbedBuilder()
    .setColor(isOpen ? 0x2ecc71 : 0xf1c40f)
    .setTitle('🎨 Azero GFX — Studio Status')
    .setDescription(
      '> Real-time status of the GFX studio.\n> Use `/q-add` to reserve your spot.',
    )
    .addFields(
      {
        name: '📡 Studio Status',
        value: statusLine,
        inline: false,
      },
      {
        name: '📦 Current Workload',
        value: `${workloadBar}\n**${activeCount} / 10** active order${activeCount !== 1 ? 's' : ''}`,
        inline: false,
      },
      {
        name: '🕐 Last Updated',
        value: `<t:${nowUnix}:F>  ·  <t:${nowUnix}:R>`,
        inline: false,
      },
    )
    .setFooter({ text: 'Azero GFX Studio  •  Updates automatically on every order change' })
    .setTimestamp();
}

function buildWorkloadBar(active: number, max = 10): string {
  const filled = Math.min(active, max);
  const empty = max - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `\`${bar}\``;
}

// ── Update helper ─────────────────────────────────────────────────────────────

async function findStatusChannel(client: Client): Promise<TextChannel | null> {
  try {
    const channel = await client.channels.fetch(STATUS_CHANNEL_ID);
    if (channel && channel.isTextBased()) return channel as TextChannel;
  } catch (err: any) {
    console.error('[Status] Could not fetch status channel:', err?.message ?? err);
  }
  return null;
}

/**
 * Edits the stored status banner message to reflect current queue state.
 * Returns true on success.
 */
export async function updateStatusEmbed(client: Client, guildId: string): Promise<boolean> {
  const channel = await findStatusChannel(client);
  if (!channel) return false;

  const embed = buildStatusEmbed();
  const stored = getStatusMessage(guildId);

  if (stored) {
    try {
      const msg = await channel.messages.fetch(stored.message_id);
      await msg.edit({ embeds: [embed] });
      return true;
    } catch (err: any) {
      if (err?.code !== 10008) {
        console.error('[Status] Failed to edit status embed:', err?.message ?? err);
        return false;
      }
      // Message was deleted — fall through to post a fresh one
    }
  }

  try {
    const newMsg = await channel.send({ embeds: [embed] });
    setStatusMessage(guildId, channel.id, newMsg.id);
    return true;
  } catch (err: any) {
    console.error('[Status] Failed to send status embed:', err?.message ?? err);
    return false;
  }
}
