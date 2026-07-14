import { Command } from './Command';
import { Restore } from './commands/Restore';
import { Vouch } from './commands/Vouch';
import { Wipe } from './commands/Wipeout';
import { QueueAdd } from './commands/QueueAdd';
import { QueueStart } from './commands/QueueStart';
import { QueueComplete } from './commands/QueueComplete';
import { QueueClear } from './commands/QueueClear';
import { PortfolioAdd } from './commands/PortfolioAdd';
import { Paid } from './commands/Paid';
import { Earnings } from './commands/Earnings';
import { SetupStatus } from './commands/SetupStatus';
import { Refer } from './commands/Refer';
import { MyTasks } from './commands/MyTasks';

export const Commands: Command[] = [Vouch, Restore, Wipe, QueueAdd, QueueStart, QueueComplete, QueueClear, PortfolioAdd, Paid, Earnings, SetupStatus, Refer, MyTasks];
