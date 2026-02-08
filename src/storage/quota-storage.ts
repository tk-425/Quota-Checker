/**
 * Global quota storage module
 * Persists quota data to ~/.quota-checker/quota.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { QuotaSnapshot, ModelQuotaInfo } from '../lib/quota/types';
import { debug, error } from '../logger';

// Storage directory and file paths
const QUOTA_DIR = path.join(os.homedir(), '.quota-checker');
const QUOTA_FILE = path.join(QUOTA_DIR, 'quota.json');

/**
 * Stored model quota with absolute reset timestamp
 */
export interface StoredModelQuota {
  label: string;
  modelId: string;
  remainingPercentage: number;
  isExhausted: boolean;
  resetAt: number; // Absolute Unix timestamp (ms) - used when quota < 100%
  frozenResetMs?: number; // Frozen remaining time (ms) - used when quota = 100%
}

/**
 * Stored account quota data
 */
export interface StoredAccountQuota {
  lastUpdated: number; // Unix timestamp (ms) when this account was last polled
  models: Record<string, StoredModelQuota>;
}

/**
 * Complete quota store keyed by email
 */
export interface QuotaStore {
  [email: string]: StoredAccountQuota;
}

/**
 * Ensure the quota directory exists
 */
export async function ensureQuotaDir(): Promise<void> {
  try {
    await fs.promises.mkdir(QUOTA_DIR, { recursive: true });
    debug('quota-storage', `Ensured directory: ${QUOTA_DIR}`);
  } catch (err) {
    error(`Failed to create quota directory: ${err}`);
    throw err;
  }
}

/**
 * Read the quota store from disk
 * Returns empty object if file doesn't exist
 */
export async function readQuotaStore(): Promise<QuotaStore> {
  try {
    const data = await fs.promises.readFile(QUOTA_FILE, 'utf-8');
    const store = JSON.parse(data) as QuotaStore;
    debug(
      'quota-storage',
      `Read quota store: ${Object.keys(store).length} accounts`
    );
    return store;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      debug(
        'quota-storage',
        'Quota file does not exist, returning empty store'
      );
      return {};
    }
    error(`Failed to read quota store: ${err}`);
    throw err;
  }
}

/**
 * Write the quota store to disk
 */
export async function writeQuotaStore(store: QuotaStore): Promise<void> {
  try {
    await ensureQuotaDir();
    await fs.promises.writeFile(
      QUOTA_FILE,
      JSON.stringify(store, null, 2),
      'utf-8'
    );
    debug(
      'quota-storage',
      `Wrote quota store: ${Object.keys(store).length} accounts`
    );
  } catch (err) {
    error(`Failed to write quota store: ${err}`);
    throw err;
  }
}

/**
 * Convert a ModelQuotaInfo to StoredModelQuota with absolute reset timestamp
 */
function toStoredModel(model: ModelQuotaInfo): StoredModelQuota {
  // Convert relative timeUntilResetMs to absolute resetAt timestamp
  const resetAt = model.timeUntilResetMs
    ? Date.now() + model.timeUntilResetMs
    : 0;

  const pct = model.remainingPercentage ?? 0;

  return {
    label: model.label,
    modelId: model.modelId,
    remainingPercentage: pct,
    isExhausted: model.isExhausted,
    resetAt,
    // For 100% quota, store frozen time so it doesn't decay for non-local accounts
    frozenResetMs: pct >= 1.0 ? model.timeUntilResetMs : undefined,
  };
}

/**
 * Upsert account quota data from a snapshot
 * If email exists, update it. Otherwise, add new entry.
 */
export async function upsertAccountQuota(
  email: string,
  snapshot: QuotaSnapshot
): Promise<void> {
  try {
    const store = await readQuotaStore();
    const existingAccount = store[email];

    // Convert models array to record keyed by modelId
    const models: Record<string, StoredModelQuota> = {};
    for (const model of snapshot.models) {
      const stored = toStoredModel(model);

      // If quota is 100% and we have existing data, preserve the old values
      // This keeps the frozen display time stable for non-local accounts
      if (
        stored.remainingPercentage >= 1.0 &&
        existingAccount?.models[model.modelId]
      ) {
        const existing = existingAccount.models[model.modelId];
        if (existing.resetAt) stored.resetAt = existing.resetAt;
        if (existing.frozenResetMs)
          stored.frozenResetMs = existing.frozenResetMs;
      }

      models[model.modelId] = stored;
    }

    // Upsert the account
    store[email] = {
      lastUpdated: Date.now(),
      models,
    };

    await writeQuotaStore(store);
    debug('quota-storage', `Upserted account: ${email}`);
  } catch (err) {
    error(`Failed to upsert account quota: ${err}`);
    // Don't throw - storage failure shouldn't break the extension
  }
}

/**
 * Get all stored accounts (for webview display)
 */
export async function getAllStoredAccounts(): Promise<QuotaStore> {
  try {
    return await readQuotaStore();
  } catch {
    return {};
  }
}
