import { detectAntigravityProcess } from './lib/local/process-detector';
import { discoverPorts } from './lib/local/port-detective';
import { probeForConnectAPI } from './lib/local/port-prober';
import { ConnectClient } from './lib/local/connect-client';
import { parseLocalQuotaSnapshot } from './lib/local/local-parser';
import type { QuotaSnapshot } from './lib/quota/types';
import { upsertAccountQuota } from './storage/quota-storage';
import { debug, error } from './logger';

export class QuotaService {
  private cachedSnapshot: QuotaSnapshot | null = null;
  private lastError: Error | null = null;

  /**
   * Fetch current quota from local Antigravity instance
   */
  async getQuota(): Promise<QuotaSnapshot> {
    try {
      debug('quota-service', 'Fetching quota...');

      // Step 1: Detect Antigravity process
      const processInfo = await detectAntigravityProcess();
      if (!processInfo) {
        throw new Error('Antigravity process not found');
      }

      debug('quota-service', `Found process PID ${processInfo.pid}`);

      // Step 2: Discover listening ports
      const ports = await discoverPorts(processInfo.pid);
      if (ports.length === 0) {
        throw new Error('No listening ports found for Antigravity');
      }

      debug('quota-service', `Found ${ports.length} ports`);

      // Step 3: Probe for Connect API
      const endpoint = await probeForConnectAPI(ports, processInfo.csrfToken);
      if (!endpoint) {
        throw new Error('Could not find Connect API endpoint');
      }

      debug('quota-service', `Found endpoint: ${endpoint.baseUrl}`);

      // Step 4: Fetch user status
      const client = new ConnectClient(endpoint.baseUrl, processInfo.csrfToken);
      const userStatus = await client.getUserStatus();

      // Step 5: Parse to QuotaSnapshot
      const snapshot = parseLocalQuotaSnapshot(userStatus);

      // Step 6: Persist to global storage
      if (snapshot.email) {
        await upsertAccountQuota(snapshot.email, snapshot);
      }

      this.cachedSnapshot = snapshot;
      this.lastError = null;

      return snapshot;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      error(`Failed to fetch quota: ${e.message}`);
      this.lastError = e;
      throw e;
    }
  }

  /**
   * Get cached snapshot (for sync access)
   */
  getCached(): QuotaSnapshot | null {
    return this.cachedSnapshot;
  }

  /**
   * Get last error
   */
  getLastError(): Error | null {
    return this.lastError;
  }
}
