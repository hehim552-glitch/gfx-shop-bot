import { CommandInteraction, Client, Interaction } from 'discord.js';
import { Commands } from '../Commands';
import { setClaimedReward, REWARD_LABELS } from '../database/referrals';

export default (client: Client): void => {
  client.on('interactionCreate', async (interaction: Interaction) => {
    if (interaction.isCommand() || interaction.isContextMenuCommand()) {
      try {
        await handleSlashCommand(client, interaction);
      } catch (error) {
        console.log('could not handle slash command', error);
      }
      return;
    }

    if (interaction.isButton()) {
      try {
        await handleButton(interaction);
      } catch (error) {
        console.error('[Button error]', interaction.customId, error);
      }
    }
  });
};

// ── Button handler ─────────────────────────────────────────────────────────────

async function handleButton(interaction: import('discord.js').ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  if (parts[0] !== 'referral_reward') return;

  const [, rewardKey, targetUserId] = parts;

  // Only the intended recipient can claim
  if (interaction.user.id !== targetUserId) {
    await interaction.reply({
      ephemeral: true,
      content: "❌ This reward isn't for you.",
    });
    return;
  }

  const label = REWARD_LABELS[rewardKey];
  if (!label) {
    await interaction.reply({ ephemeral: true, content: '❌ Unknown reward type.' });
    return;
  }

  setClaimedReward(targetUserId, rewardKey);

  await interaction.update({
    content: `✅ **Reward locked in!**\n\n${label}\n\nThis will be applied automatically when your next order is placed. The designer will see it on your order. 🎉`,
    embeds: [],
    components: [],
  });
}

// ── Slash command handler ──────────────────────────────────────────────────────

const handleSlashCommand = async (
  client: Client,
  interaction: CommandInteraction,
): Promise<void> => {
  const slashCommand = Commands.find((c) => c.name === interaction.commandName);
  if (!slashCommand) {
    interaction.followUp({ content: 'An error has occurred' });
    return;
  }

  await interaction.deferReply();

  try {
    await slashCommand.run(client, interaction);
  } catch (error) {
    console.error('[Command error]', interaction.commandName, error);
    try {
      await interaction.followUp({
        ephemeral: true,
        content: '❌ An unexpected error occurred while running this command.',
      });
    } catch {
      // interaction already expired — nothing we can do
    }
  }
};
