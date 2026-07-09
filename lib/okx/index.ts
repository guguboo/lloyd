import { dbJobMonitor, dbReputationSource, loggingTreasury } from './fixtures';
import { testnetTreasury } from './real';
import type { JobMonitor, ReputationSource, Treasury } from './types';

// fixture: nothing moves (logs only). testnet: real X Layer testnet payouts (nominal OKB).
// real: mainnet — deliberately not wired; gated on the go-live security fixes (decisions.md §D9).
const mode = () => process.env.LLOYD_MODE ?? 'fixture';

export function getReputationSource(): ReputationSource {
  return dbReputationSource; // curated dossiers; a real reputation feed lands with mainnet go-live
}
export function getJobMonitor(): JobMonitor {
  if (mode() === 'real') throw new Error('real (mainnet) JobMonitor not wired — see decisions.md §D9');
  return dbJobMonitor; // fixture + testnet both read job state from the DB (demo_jobs)
}
export function getTreasury(): Treasury {
  const m = mode();
  if (m === 'testnet') return testnetTreasury; // real, verifiable X Layer testnet payouts
  if (m === 'real') throw new Error('real (mainnet) Treasury not wired — see decisions.md §D9');
  return loggingTreasury; // fixture: logs a placeholder hash, no money moves
}
