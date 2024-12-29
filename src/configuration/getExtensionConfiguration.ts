import * as vscode from "vscode";

export function getExtensionConfiguration(): { featurePaths: string[], env: { [key: string]: string }, cliOptions: string[], cucumberPath: string, cwd: string  } {
    const configuration = vscode.workspace.getConfiguration('cucumber_runner');
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath!;
    const cwd = configuration.get<string>('cwd')!.trim().length > 0 ? configuration.get<string>('cwd')!.replace(/\$\{workspaceFolder\}/g, workspaceFolder) : workspaceFolder;
    return {
        featurePaths: configuration.get<string[]>('features')!,
        env: configuration.get<{ [key: string]: string }>('env_variables')!,
        cwd: cwd,
        cliOptions: configuration.get<string[]>('cli_options')!,
        cucumberPath: configuration.get<string>('cucumber_path')!,
    }
}
