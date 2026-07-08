import { dbJobMonitor, dbReputationSource, loggingTreasury } from './fixtures';
import type { JobMonitor, ReputationSource, Treasury } from './types';

const mode = () => process.env.LLOYD_MODE ?? 'fixture';

export function getReputationSource(): ReputationSource {
  return dbReputationSource; // real reputation feed lands in Task 9 if unknown #2/#4 allow
}
export function getJobMonitor(): JobMonitor {
  if (mode() === 'real') throw new Error('real JobMonitor not wired yet — Task 9');
  return dbJobMonitor;
}
export function getTreasury(): Treasury {
  if (mode() === 'real') throw new Error('real Treasury not wired yet — Task 9');
  return loggingTreasury;
}
