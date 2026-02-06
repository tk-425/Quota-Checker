import type { QuotaSnapshot } from '../lib/quota/types';

export function getWebviewContent(
  snapshot: QuotaSnapshot | null,
  error?: Error,
  selectedModels?: string[]
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
      const hours = Math.floor(m.timeUntilResetMs / (1000 * 60 * 60));
      const minutes = Math.floor(
        (m.timeUntilResetMs % (1000 * 60 * 60)) / (1000 * 60)
      );
      resetInfo = `Resets in ${hours}h ${minutes}m`;
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

  const accountsHTML = () => {
    return `
      ${snapshot.email ? `<div class="account-email">${escapeHtml(snapshot.email)}</div>` : ''}
      ${modelsHtml}
    `;
  };

  return `<!DOCTYPE html>
    <html>
    <head><style>${styles}</style></head>
    <body>
      <h1>
        Quota Dashboard
        <button class="refresh-btn" onclick="refresh()">↻ Refresh</button>
      </h1>
      ${accountsHTML()}
      <div class="timestamp">Last updated: ${snapshot.timestamp}</div>
      <script>
        const vscode = acquireVsCodeApi();
        function refresh() { vscode.postMessage({ command: 'refresh' }); }
        function toggleModel(modelId, selected) { 
          vscode.postMessage({ command: 'toggleModel', modelId, selected }); 
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
