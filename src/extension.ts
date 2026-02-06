import * as vscode from 'vscode';
import { QuotaService } from './quota-service';
import { StatusBarManager } from './status-bar';
import { QuotaWebviewPanel } from './webview/panel';
import { getOutputChannel, info, error } from './logger';

let quotaService: QuotaService;
let statusBar: StatusBarManager;
let pollingInterval: NodeJS.Timeout | undefined;
let extensionContext: vscode.ExtensionContext;

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
        handleToggleModel
      );
      panel.update(
        quotaService.getCached(),
        quotaService.getLastError() ?? undefined,
        getSelectedModels()
      );
      // Also refresh when opening dashboard
      fetchQuota();
    }
  );

  // Initial fetch
  fetchQuota();

  // Start polling
  const intervalMs =
    vscode.workspace
      .getConfiguration('quota-checker')
      .get('pollingInterval', 60) * 1000;
  pollingInterval = setInterval(fetchQuota, intervalMs);

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
 * Handle toggle model checkbox from webview
 */
function handleToggleModel(modelId: string, selected: boolean) {
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

  statusBar.update(snapshot, updated, err);
  QuotaWebviewPanel.updateCurrent(snapshot, err, updated);

  info(
    `Model ${modelId} ${selected ? 'selected' : 'deselected'} for status bar`
  );
}

async function fetchQuota() {
  const selectedModels = getSelectedModels();

  try {
    const snapshot = await quotaService.getQuota();
    info(`Fetched quota: ${snapshot.models.length} models`);

    // Update UI
    statusBar.update(snapshot, selectedModels);
    QuotaWebviewPanel.updateCurrent(snapshot, undefined, selectedModels);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    error(`Fetch failed: ${e.message}`);

    // Update UI with error
    statusBar.update(null, selectedModels, e);
    QuotaWebviewPanel.updateCurrent(null, e, selectedModels);
  }
}

export function deactivate() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
}
