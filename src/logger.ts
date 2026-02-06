import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Quota Checker');
  }
  return outputChannel;
}

export function debug(
  label: string,
  message?: string | unknown,
  data?: unknown
): void {
  if (message === undefined) {
    getOutputChannel().appendLine(`[DEBUG] ${label}`);
  } else if (data !== undefined) {
    getOutputChannel().appendLine(
      `[DEBUG] [${label}] ${message} ${JSON.stringify(data)}`
    );
  } else {
    getOutputChannel().appendLine(`[DEBUG] [${label}] ${message}`);
  }
}

export function info(message: string): void {
  getOutputChannel().appendLine(`[INFO] ${message}`);
}

export function error(message: string): void {
  getOutputChannel().appendLine(`[ERROR] ${message}`);
}
