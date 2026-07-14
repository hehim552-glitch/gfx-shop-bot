import { Client, GuildMember } from 'discord.js';

const AUTO_ROLE_ID = '1523964671349227530';

export default (client: Client): void => {
  client.on('guildMemberAdd', async (member: GuildMember) => {
    try {
      await member.roles.add(AUTO_ROLE_ID);
      console.log(`[MemberJoin] Assigned role ${AUTO_ROLE_ID} to ${member.user.tag} (${member.user.id})`);
    } catch (error: any) {
      console.error(
        `[MemberJoin] Failed to assign role to ${member.user.tag} (${member.user.id}):`,
        error?.message ?? error,
      );
    }
  });
};
