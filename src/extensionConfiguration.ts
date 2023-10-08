import * as vscode from "vscode";

export function getExtensionConfiguration(): { featurePaths: string[], env: { [key: string]: string }, cliOptions: string[] } {
    const configuration = vscode.workspace.getConfiguration('cucumber_runner');
    return {
        featurePaths: configuration.get<string[]>('features')!,
        env: configuration.get<{ [key: string]: string }>('env_variables')!,
        cliOptions: configuration.get<string[]>('cli_options')!,
    }
}