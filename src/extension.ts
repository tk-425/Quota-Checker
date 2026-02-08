import * as vscode from 'vscode';
import { QuotaService } from './quota-service';
import { StatusBarManager } from './status-bar';
import { QuotaWebviewPanel } from './webview/panel';
import { getAllStoredAccounts } from './storage/quota-storage';
import { getOutputChannel, info, error } from './logger';

let quotaService: QuotaService;
let statusBar: StatusBarManager;
let pollingInterval: NodeJS.Timeout | undefined;
let extensionContext: vscode.ExtensionContext;
let isIntensiveMode = false;

// State key for persisting selected models
const SELECTED_MODELS_KEY = 'quota-checker.selectedModels';

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;
  const outputChannel = getOutputChannel();
  outputChannel.appendLine('Quota Checker extension activated');

  // Initialize services
  quotaService = new QuotaService();
  statusBar = new StatusBarManager();

  // Register command
  const openDashboard = vscode.commands.registerCommand(
    'quota-checker.openDashboard',
    () => {
      const panel = QuotaWebviewPanel.createOrShow(
        context.extensionUri,
        fetchQuota,
        handleToggleModel,
        handleSetInterval
      );
      panel.update(
        quotaService.getCached(),
        quotaService.getLastError() ?? undefined,
        getSelectedModels(),
        isIntensiveMode
      );
      // Also refresh when opening dashboard
      fetchQuota();
    }
  );

  // Initial fetch
  fetchQuota();

  // Start polling (default 5 minutes)
  startPolling();

  context.subscriptions.push(openDashboard);
  context.subscriptions.push(statusBar);
  context.subscriptions.push({
    dispose: () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    },
  });

  info('Extension activated successfully');
}

/**
 * Get selected models from global state
 */
function getSelectedModels(): string[] {
  return extensionContext.globalState.get<string[]>(SELECTED_MODELS_KEY, []);
}

/**
 * Start or restart polling with current interval setting
 */
function startPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  const intervalMs = isIntensiveMode ? 60 * 1000 : 300 * 1000;
  pollingInterval = setInterval(fetchQuota, intervalMs);
  info(
    `Polling started: ${isIntensiveMode ? '60s (intensive)' : '5m (normal)'}`
  );
}

/**
 * Handle interval change from webview
 */
async function handleSetInterval(intensive: boolean) {
  isIntensiveMode = intensive;
  startPolling();

  // Update webview to reflect new mode
  const snapshot = quotaService.getCached();
  const err = quotaService.getLastError() ?? undefined;
  const storedAccounts = await getAllStoredAccounts();
  QuotaWebviewPanel.updateCurrent(
    snapshot,
    err,
    getSelectedModels(),
    isIntensiveMode,
    storedAccounts
  );

  info(
    `Polling mode changed to ${intensive ? 'intensive (60s)' : 'normal (5m)'}`
  );
}

/**
 * Handle toggle model checkbox from webview
 */
async function handleToggleModel(modelId: string, selected: boolean) {
  const current = getSelectedModels();
  let updated: string[];

  if (selected) {
    // Add if not already present
    updated = current.includes(modelId) ? current : [...current, modelId];
  } else {
    // Remove
    updated = current.filter((id) => id !== modelId);
  }

  // Persist
  extensionContext.globalState.update(SELECTED_MODELS_KEY, updated);

  // Update UI immediately
  const snapshot = quotaService.getCached();
  const err = quotaService.getLastError() ?? undefined;
  const storedAccounts = await getAllStoredAccounts();

  statusBar.update(snapshot, updated, err);
  QuotaWebviewPanel.updateCurrent(
    snapshot,
    err,
    updated,
    isIntensiveMode,
    storedAccounts
  );

  info(
    `Model ${modelId} ${selected ? 'selected' : 'deselected'} for status bar`
  );
}

async function fetchQuota() {
  const selectedModels = getSelectedModels();

  try {
    const snapshot = await quotaService.getQuota();
    info(`Fetched quota: ${snapshot.models.length} models`);

    // Load all stored accounts for webview
    const storedAccounts = await getAllStoredAccounts();

    // Update UI
    statusBar.update(snapshot, selectedModels);
    QuotaWebviewPanel.updateCurrent(
      snapshot,
      undefined,
      selectedModels,
      isIntensiveMode,
      storedAccounts
    );
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    error(`Fetch failed: ${e.message}`);

    // Load stored accounts even on error
    const storedAccounts = await getAllStoredAccounts();

    // Update UI with error
    statusBar.update(null, selectedModels, e);
    QuotaWebviewPanel.updateCurrent(
      null,
      e,
      selectedModels,
      isIntensiveMode,
      storedAccounts
    );
  }
}

export function deactivate() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
}
