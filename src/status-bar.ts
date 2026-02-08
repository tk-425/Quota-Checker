import * as vscode from 'vscode';
import type { QuotaSnapshot, ModelQuotaInfo } from './lib/quota/types';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'quota-checker.openDashboard';
    this.statusBarItem.tooltip = 'Click to open Quota Dashboard';
    this.statusBarItem.text = '$(sync~spin) Quota: Connecting...';
    this.statusBarItem.show();
  }

  /**
   * Show "Connecting..." status during startup retry
   */
  showConnecting() {
    this.statusBarItem.text = '$(sync~spin) Quota: Connecting...';
    this.statusBarItem.backgroundColor = undefined;
  }

  /**
   * Update status bar with quota data
   * @param snapshot Quota snapshot
   * @param selectedModels Array of model IDs to display (from checkboxes)
   * @param error Error if any
   */
  update(
    snapshot: QuotaSnapshot | null,
    selectedModels: string[],
    error?: Error
  ) {
    if (error) {
      this.statusBarItem.text = '$(warning) Quota: Error';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
      return;
    }

    if (!snapshot) {
      this.statusBarItem.text = '$(sync~spin) Quota: Loading...';
      this.statusBarItem.backgroundColor = undefined;
      return;
    }

    // Filter models based on selected checkboxes
    const modelsToShow = snapshot.models.filter((m) =>
      selectedModels.includes(m.modelId)
    );

    if (modelsToShow.length === 0) {
      this.statusBarItem.text = '$(dashboard) Quota: Select models';
      this.statusBarItem.backgroundColor = undefined;
    } else {
      const parts = modelsToShow.map((m) => this.formatModel(m));
      this.statusBarItem.text = `$(dashboard) ${parts.join(' | ')}`;

      // Check for exhausted models (only selected ones) - show error
      // Also treat undefined percentage with isExhausted as exhausted
      const exhausted = modelsToShow.some(
        (m) => m.isExhausted || m.remainingPercentage === 0
      );
      // Check for low quota (<= 20%) - show warning
      // If exhausted, remainingPercentage might be undefined, treat as 0
      const lowQuota = modelsToShow.some((m) => {
        const pct = m.isExhausted ? 0 : (m.remainingPercentage ?? 1);
        return pct <= 0.2;
      });

      if (exhausted) {
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.errorBackground'
        );
      } else if (lowQuota) {
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.warningBackground'
        );
      } else {
        this.statusBarItem.backgroundColor = undefined;
      }
    }
  }

  private formatModel(model: ModelQuotaInfo): string {
    const label = this.getShortLabel(model.label);
    const pct = model.remainingPercentage;

    // If exhausted but no percentage, treat as 0%
    if (model.isExhausted && pct === undefined) {
      return `${label} 0%`;
    }

    if (pct === undefined) {
      return `${label}: --`;
    }

    return `${label} ${Math.round(pct * 100)}%`;
  }

  private getShortLabel(label: string): string {
    // Extract short name (e.g., "Claude 3.5 Sonnet" → "Sonnet")
    // For more specific display, extract the model variant
    const lower = label.toLowerCase();

    if (lower.includes('sonnet')) {
      if (lower.includes('thinking')) return 'Sonnet-T';
      return 'Sonnet';
    }
    if (lower.includes('opus')) return 'Opus';
    if (lower.includes('flash')) return 'Flash';
    if (lower.includes('pro')) {
      if (lower.includes('thinking')) return 'Pro-T';
      if (lower.includes('low')) return 'Pro-L';
      return 'Pro';
    }
    if (lower.includes('4o')) return '4o';
    if (lower.includes('o1')) return 'o1';

    // Fallback: first word
    return label.split(' ')[0];
  }

  dispose() {
    this.statusBarItem.dispose();
  }
}
