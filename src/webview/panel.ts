import * as vscode from 'vscode';
import type { QuotaSnapshot } from '../lib/quota/types';
import type { QuotaStore } from '../storage/quota-storage';
import { getWebviewContent } from './template';

export type ToggleModelCallback = (modelId: string, selected: boolean) => void;
export type SetIntervalCallback = (intensive: boolean) => void;

export class QuotaWebviewPanel {
  private static currentPanel: QuotaWebviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private snapshot: QuotaSnapshot | null = null;
  private error: Error | undefined;
  private selectedModels: string[] = [];
  private isIntensiveMode = false;
  private storedAccounts: QuotaStore = {};
  private onRefreshRequest: () => void;
  private onToggleModel: ToggleModelCallback;
  private onSetInterval: SetIntervalCallback;

  private constructor(
    panel: vscode.WebviewPanel,
    onRefreshRequest: () => void,
    onToggleModel: ToggleModelCallback,
    onSetInterval: SetIntervalCallback
  ) {
    this.panel = panel;
    this.onRefreshRequest = onRefreshRequest;
    this.onToggleModel = onToggleModel;
    this.onSetInterval = onSetInterval;

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage((message) => {
      if (message.command === 'refresh') {
        this.onRefreshRequest();
      } else if (message.command === 'toggleModel') {
        this.onToggleModel(message.modelId, message.selected);
      } else if (message.command === 'setInterval') {
        this.onSetInterval(message.intensive);
      }
    });

    // Handle panel disposal
    this.panel.onDidDispose(() => {
      QuotaWebviewPanel.currentPanel = undefined;
    });
  }

  static createOrShow(
    extensionUri: vscode.Uri,
    onRefreshRequest: () => void,
    onToggleModel: ToggleModelCallback,
    onSetInterval: SetIntervalCallback
  ): QuotaWebviewPanel {
    const column = vscode.ViewColumn.Beside;

    // If panel exists, reveal it
    if (QuotaWebviewPanel.currentPanel) {
      QuotaWebviewPanel.currentPanel.panel.reveal(column);
      return QuotaWebviewPanel.currentPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'quotaDashboard',
      'Quota Dashboard',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    QuotaWebviewPanel.currentPanel = new QuotaWebviewPanel(
      panel,
      onRefreshRequest,
      onToggleModel,
      onSetInterval
    );

    return QuotaWebviewPanel.currentPanel;
  }

  update(
    snapshot: QuotaSnapshot | null,
    error?: Error,
    selectedModels?: string[],
    isIntensiveMode?: boolean,
    storedAccounts?: QuotaStore
  ) {
    this.snapshot = snapshot;
    this.error = error;
    if (selectedModels !== undefined) {
      this.selectedModels = selectedModels;
    }
    if (isIntensiveMode !== undefined) {
      this.isIntensiveMode = isIntensiveMode;
    }
    if (storedAccounts !== undefined) {
      this.storedAccounts = storedAccounts;
    }
    this.panel.webview.html = getWebviewContent(
      snapshot,
      error,
      this.selectedModels,
      this.isIntensiveMode,
      this.storedAccounts
    );
  }

  static getCurrent(): QuotaWebviewPanel | undefined {
    return QuotaWebviewPanel.currentPanel;
  }

  static updateCurrent(
    snapshot: QuotaSnapshot | null,
    error?: Error,
    selectedModels?: string[],
    isIntensiveMode?: boolean,
    storedAccounts?: QuotaStore
  ) {
    if (QuotaWebviewPanel.currentPanel) {
      QuotaWebviewPanel.currentPanel.update(
        snapshot,
        error,
        selectedModels,
        isIntensiveMode,
        storedAccounts
      );
    }
  }
}
