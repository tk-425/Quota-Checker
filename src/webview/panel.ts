import * as vscode from 'vscode';
import type { QuotaSnapshot } from '../lib/quota/types';
import { getWebviewContent } from './template';

export type ToggleModelCallback = (modelId: string, selected: boolean) => void;

export class QuotaWebviewPanel {
  private static currentPanel: QuotaWebviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private snapshot: QuotaSnapshot | null = null;
  private error: Error | undefined;
  private selectedModels: string[] = [];
  private onRefreshRequest: () => void;
  private onToggleModel: ToggleModelCallback;

  private constructor(
    panel: vscode.WebviewPanel,
    onRefreshRequest: () => void,
    onToggleModel: ToggleModelCallback
  ) {
    this.panel = panel;
    this.onRefreshRequest = onRefreshRequest;
    this.onToggleModel = onToggleModel;

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage((message) => {
      if (message.command === 'refresh') {
        this.onRefreshRequest();
      } else if (message.command === 'toggleModel') {
        this.onToggleModel(message.modelId, message.selected);
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
    onToggleModel: ToggleModelCallback
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
      onToggleModel
    );

    return QuotaWebviewPanel.currentPanel;
  }

  update(
    snapshot: QuotaSnapshot | null,
    error?: Error,
    selectedModels?: string[]
  ) {
    this.snapshot = snapshot;
    this.error = error;
    if (selectedModels !== undefined) {
      this.selectedModels = selectedModels;
    }
    this.panel.webview.html = getWebviewContent(
      snapshot,
      error,
      this.selectedModels
    );
  }

  static getCurrent(): QuotaWebviewPanel | undefined {
    return QuotaWebviewPanel.currentPanel;
  }

  static updateCurrent(
    snapshot: QuotaSnapshot | null,
    error?: Error,
    selectedModels?: string[]
  ) {
    if (QuotaWebviewPanel.currentPanel) {
      QuotaWebviewPanel.currentPanel.update(snapshot, error, selectedModels);
    }
  }
}
