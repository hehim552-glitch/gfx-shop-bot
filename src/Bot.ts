require('dotenv').config();
import { Client, ClientOptions, Collection, IntentsBitField } from 'discord.js';
import ready from './listeners/ready';
import interactionCreate from './listeners/interactionCreate';
import guildMemberAdd from './listeners/guildMemberAdd';

const token = process.env.TOKEN;

console.log('Bot is starting...');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMembers,
  ],
});

ready(client);
interactionCreate(client);
guildMemberAdd(client);

client.login(token);
