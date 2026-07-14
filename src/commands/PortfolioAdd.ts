import {
  CommandInteraction,
  Client,
  ApplicationCommandOptionType,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { Command } from '../Command';

// Replace with your actual portfolio channel ID
const PORTFOLIO_CHANNEL_ID = '1523727785624076341';

export const PortfolioAdd: Command = {
  name: 'portfolio-add',
  description: 'Post a GFX piece to the portfolio channel',
  options: [
    {
      name: 'image',
      description: 'The image to showcase',
      type: ApplicationCommandOptionType.Attachment,
      required: true,
    },
    {
      name: 'caption',
      description: 'Short description of the piece',
      type: ApplicationCommandOptionType.String,
      required: true,
      max_length: 300,
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

    const attachment = interaction.options.getAttachment('image', true);
    const caption = interaction.options.getString('caption', true);

    if (!attachment.contentType?.startsWith('image/')) {
      await interaction.followUp({
        ephemeral: true,
        content: '❌ The attachment must be an image file (png, jpg, gif, etc.).',
      });
      return;
    }

    let portfolioChannel: TextChannel | null = null;
    try {
      const channel = await client.channels.fetch(PORTFOLIO_CHANNEL_ID);
      if (channel && channel.isTextBased()) portfolioChannel = channel as TextChannel;
    } catch (error: any) {
      console.error('[Portfolio] Could not fetch channel:', error?.message ?? error);
    }

    if (!portfolioChannel) {
      await interaction.followUp({
        ephemeral: true,
        content: '❌ Could not find the portfolio channel. Update `PORTFOLIO_CHANNEL_ID` in `src/commands/PortfolioAdd.ts`.',
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setImage(attachment.url)
      .setDescription(caption)
      .setFooter({ text: `Posted by ${interaction.user.username}` })
      .setTimestamp();

    try {
      await portfolioChannel.send({ embeds: [embed] });
    } catch (error: any) {
      console.error('[Portfolio] Failed to send embed:', error?.message ?? error);
      await interaction.followUp({
        ephemeral: true,
        content: '❌ Could not post to the portfolio channel. Check the bot has **Send Messages** and **Embed Links** permissions there.',
      });
      return;
    }

    await interaction.followUp({
      ephemeral: true,
      content: '✅ Portfolio piece posted!',
    });
  },
};
