import type { QuotaSnapshot, ModelQuotaInfo } from '../lib/quota/types';
import type { QuotaStore, StoredModelQuota } from '../storage/quota-storage';

export function getWebviewContent(
  snapshot: QuotaSnapshot | null,
  error?: Error,
  selectedModels?: string[],
  isIntensiveMode?: boolean,
  storedAccounts?: QuotaStore
): string {
  const styles = `
    body { 
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
    }
    h1 { 
      font-size: 1.5em;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .model-card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .model-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .model-name { font-weight: bold; }
    .model-pct { color: var(--vscode-descriptionForeground); }
    .progress-bar {
      height: 8px;
      background: var(--vscode-progressBar-background);
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: var(--vscode-progressBar-background);
      transition: width 0.3s;
    }
    .progress-fill.low { background: #f14c4c; }
    .progress-fill.medium { background: #cca700; }
    .progress-fill.high { background: #89d185; }
    .refresh-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    .refresh-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .interval-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
    }
    .interval-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .interval-btn.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .header-controls {
      display: flex;
      gap: 8px;
    }
    .error {
      color: var(--vscode-errorForeground);
      background: var(--vscode-inputValidation-errorBackground);
      padding: 12px;
      border-radius: 4px;
    }
    .timestamp {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
      margin-top: 16px;
    }
    .reset-time {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
      margin-top: 8px;
    }
    .model-group {
      margin-bottom: 24px;
    }
    .group-header {
      font-size: 1.1em;
      font-weight: 600;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--vscode-editorWidget-border);
      color: var(--vscode-foreground);
    }
    .model-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .model-checkbox input {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .model-checkbox label {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
    }
    .model-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--vscode-editorWidget-border);
    }
    .user-info {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-editorWidget-border);
    }
    .user-info .email {
      font-weight: 500;
    }
    .group-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--vscode-editorWidget-border);
    }
    .group-header-row .group-header {
      margin: 0;
      padding: 0;
      border: none;
    }
    .account-email {
      font-size: 1.2em;
      color: var(--vscode-descriptionForeground);
    }
    .account-section {
      margin-bottom: 32px;
      padding: 16px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 8px;
    }
    .account-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-editorWidget-border);
    }
    .account-header .email {
      font-size: 1.1em;
      font-weight: 600;
    }
    .account-header .badge {
      font-size: 0.85em;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .account-header .last-updated {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }
    .stored-model-card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 8px;
      opacity: 0.85;
    }
  `;

  if (error) {
    return `<!DOCTYPE html>
      <html>
      <head><style>${styles}</style></head>
      <body>
        <h1>Quota Dashboard</h1>
        <div class="error">
          <strong>Error:</strong> ${escapeHtml(error.message)}
        </div>
        <button class="refresh-btn" onclick="refresh()">Retry</button>
        <script>
          const vscode = acquireVsCodeApi();
          function refresh() { vscode.postMessage({ command: 'refresh' }); }
        </script>
      </body>
      </html>`;
  }

  if (!snapshot) {
    return `<!DOCTYPE html>
      <html>
      <head><style>${styles}</style></head>
      <body>
        <h1>Quota Dashboard</h1>
        <p>Loading...</p>
      </body>
      </html>`;
  }

  // Group models by provider
  const groups: Record<string, typeof snapshot.models> = {
    Claude: [],
    Gemini: [],
    GPT: [],
    Other: [],
  };

  snapshot.models.forEach((m) => {
    const label = m.label.toLowerCase();
    if (label.includes('claude')) {
      groups.Claude.push(m);
    } else if (label.includes('gemini')) {
      groups.Gemini.push(m);
    } else if (label.includes('gpt') || label.includes('openai')) {
      groups.GPT.push(m);
    } else {
      groups.Other.push(m);
    }
  });

  // Sort models within each group by hierarchy (lightweight → heavy)
  const getModelWeight = (label: string, group: string): number => {
    const l = label.toLowerCase();

    if (group === 'Claude') {
      if (l.includes('opus')) return 30;
      if (l.includes('sonnet') && l.includes('thinking')) return 20;
      if (l.includes('sonnet')) return 10;
      return 100;
    }

    if (group === 'Gemini') {
      if (l.includes('pro') && l.includes('thinking')) return 30;
      if (l.includes('pro') && l.includes('low')) return 20;
      if (l.includes('flash')) return 10;
      return 100;
    }

    if (group === 'GPT') {
      if (l.includes('o1')) return 20;
      if (l.includes('4o')) return 10;
      return 100;
    }

    return 100;
  };

  // Sort each group
  Object.entries(groups).forEach(([groupName, models]) => {
    models.sort(
      (a, b) =>
        getModelWeight(a.label, groupName) - getModelWeight(b.label, groupName)
    );
  });

  const renderModelCard = (m: (typeof snapshot.models)[0]) => {
    const pct = m.remainingPercentage ?? 0;
    const pctDisplay = Math.round(pct * 100);
    const colorClass = pct < 0.2 ? 'low' : pct < 0.5 ? 'medium' : 'high';

    // Format reset time
    let resetInfo = '';
    if (m.timeUntilResetMs !== undefined && m.timeUntilResetMs > 0) {
      const days = Math.floor(m.timeUntilResetMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (m.timeUntilResetMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor(
        (m.timeUntilResetMs % (1000 * 60 * 60)) / (1000 * 60)
      );
      resetInfo =
        days > 0
          ? `Resets in ${days}d ${hours}h ${minutes}m`
          : `Resets in ${hours}h ${minutes}m`;
    } else if (m.resetTime) {
      resetInfo = `Resets: ${escapeHtml(m.resetTime)}`;
    }

    const isSelected = selectedModels
      ? selectedModels.includes(m.modelId)
      : false;
    const checkboxId = `checkbox-${m.modelId.replace(/[^a-zA-Z0-9]/g, '-')}`;

    return `
      <div class="model-card">
        <div class="model-header">
          <span class="model-name">${escapeHtml(m.label)}</span>
          <span class="model-pct">${pctDisplay}% remaining</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${colorClass}" style="width: ${pctDisplay}%"></div>
        </div>
        <div class="model-footer">
          ${resetInfo ? `<span class="reset-time">${resetInfo}</span>` : '<span></span>'}
          <div class="model-checkbox">
            <input type="checkbox" id="${checkboxId}" ${isSelected ? 'checked' : ''} 
                   onchange="toggleModel('${escapeHtml(m.modelId)}', this.checked)" />
            <label for="${checkboxId}">Show in status bar</label>
          </div>
        </div>
      </div>
    `;
  };

  const modelsHtml = Object.entries(groups)
    .filter(([, models]) => models.length > 0)
    .map(
      ([groupName, models]) => `
      <div class="model-group">
        <h2 class="group-header">${groupName}</h2>
        ${models.map(renderModelCard).join('')}
      </div>
    `
    )
    .join('');

  // Helper to format time ago
  const formatTimeAgo = (timestampMs: number): string => {
    const agoMs = Date.now() - timestampMs;
    const minutes = Math.floor(agoMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h ago`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    return `${minutes}m ago`;
  };

  // Helper to format reset time from absolute timestamp
  const formatResetTime = (resetAt: number): string => {
    const msUntilReset = resetAt - Date.now();
    if (msUntilReset <= 0) return 'Expired';
    const days = Math.floor(msUntilReset / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (msUntilReset % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    return days > 0
      ? `${days}d ${hours}h ${minutes}m`
      : `${hours}h ${minutes}m`;
  };

  // Render stored model card (no checkbox)
  const renderStoredModelCard = (model: StoredModelQuota) => {
    const pct = model.remainingPercentage ?? 0;
    const pctDisplay = Math.round(pct * 100);
    const colorClass = pct < 0.2 ? 'low' : pct < 0.5 ? 'medium' : 'high';

    // For 100% quota, use frozen time (doesn't decay)
    // For < 100% quota, use resetAt with real-time calculation
    let resetInfo = '';
    if (model.frozenResetMs !== undefined && model.frozenResetMs > 0) {
      // Frozen display - doesn't change
      const days = Math.floor(model.frozenResetMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (model.frozenResetMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor(
        (model.frozenResetMs % (1000 * 60 * 60)) / (1000 * 60)
      );
      resetInfo =
        days > 0
          ? `Resets in ${days}d ${hours}h ${minutes}m`
          : `Resets in ${hours}h ${minutes}m`;
    } else if (model.resetAt > 0) {
      resetInfo = `Resets in ${formatResetTime(model.resetAt)}`;
    }

    return `
      <div class="stored-model-card">
        <div class="model-header">
          <span class="model-name">${escapeHtml(model.label)}</span>
          <span class="model-pct">${pctDisplay}% remaining</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${colorClass}" style="width: ${pctDisplay}%"></div>
        </div>
        ${resetInfo ? `<div class="reset-time">${resetInfo}</div>` : ''}
      </div>
    `;
  };

  // Render stored accounts (non-local)
  const renderStoredAccounts = (): string => {
    if (!storedAccounts) return '';

    // Get emails of stored accounts, excluding current local email
    const otherEmails = Object.keys(storedAccounts).filter(
      (email) => email !== snapshot.email
    );

    if (otherEmails.length === 0) return '';

    return otherEmails
      .map((email) => {
        const account = storedAccounts[email];
        const modelsArray = Object.values(account.models);

        // Group stored models by provider (same logic as main models)
        const storedGroups: Record<string, StoredModelQuota[]> = {
          Claude: [],
          Gemini: [],
          GPT: [],
          Other: [],
        };

        modelsArray.forEach((m) => {
          const label = m.label.toLowerCase();
          if (label.includes('claude')) storedGroups.Claude.push(m);
          else if (label.includes('gemini')) storedGroups.Gemini.push(m);
          else if (label.includes('gpt') || label.includes('openai'))
            storedGroups.GPT.push(m);
          else storedGroups.Other.push(m);
        });

        const storedModelsHtml = Object.entries(storedGroups)
          .filter(([, models]) => models.length > 0)
          .map(
            ([groupName, models]) => `
              <div class="model-group">
                <h2 class="group-header">${groupName}</h2>
                ${models.map(renderStoredModelCard).join('')}
              </div>
            `
          )
          .join('');

        return `
          <div class="account-section">
            <div class="account-header">
              <span class="email">📧 ${escapeHtml(email)}</span>
              <span class="last-updated">Last updated: ${formatTimeAgo(account.lastUpdated)}</span>
            </div>
            ${storedModelsHtml}
          </div>
        `;
      })
      .join('');
  };

  const accountsHTML = () => {
    // Local account section
    const localSection = `
      <div class="account-section">
        <div class="account-header">
          <span class="email">📧 ${snapshot.email ? escapeHtml(snapshot.email) : 'Local Account'}</span>
          <span class="badge">Local</span>
        </div>
        ${modelsHtml}
      </div>
    `;

    // Stored accounts sections
    const storedSections = renderStoredAccounts();

    return localSection + storedSections;
  };

  return `<!DOCTYPE html>
    <html>
    <head><style>${styles}</style></head>
    <body>
      <h1>
        Quota Dashboard
        <div class="header-controls">
          <button class="refresh-btn" onclick="refresh()">↻ Refresh</button>
          <button class="interval-btn ${isIntensiveMode ? 'active' : ''}" onclick="toggleInterval()">
            ${isIntensiveMode ? '🔋 Normal (5m)' : '⚡ Intensive (60s)'}
          </button>
        </div>
      </h1>
      ${accountsHTML()}
      <div class="timestamp">Last updated: ${snapshot.timestamp}</div>
      <script>
        const vscode = acquireVsCodeApi();
        function refresh() { vscode.postMessage({ command: 'refresh' }); }
        function toggleModel(modelId, selected) { 
          vscode.postMessage({ command: 'toggleModel', modelId, selected }); 
        }
        function toggleInterval() {
          vscode.postMessage({ command: 'setInterval', intensive: ${!isIntensiveMode} });
        }
      </script>
    </body>
    </html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
