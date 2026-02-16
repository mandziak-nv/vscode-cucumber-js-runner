import * as vscode from "vscode";

export const CONFIG_NAME = 'cucumberJsRunner';

export const CONFIG_SCHEMA = {
    FEATURES: { key: 'features', defaultValue: ["features/**/*.feature"] },
    ENV_VARIABLES: { key: 'env', defaultValue: {} },
    DEBUG_ENV_VARIABLES: { key: 'debugEnv', defaultValue: {} },
    CLI_OPTIONS: { key: 'cliArgs', defaultValue: [] },
    CWD: { key: 'cwd', defaultValue: '' },
    CUCUMBER_PATH: { key: 'cucumberExecutable', defaultValue: './node_modules/.bin/cucumber-js' },
} as const;

interface ExtensionConfiguration {
    featurePaths: readonly string[];
    env: Record<string, string>;
    debugEnv: Record<string, string>;
    cliOptions: readonly string[];
    cwd: string;
    cucumberPath: string;
}

export function getExtensionConfiguration(): ExtensionConfiguration {
    const workspaceConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(CONFIG_NAME);

    return {
        featurePaths: workspaceConfiguration.get<readonly string[]>(CONFIG_SCHEMA.FEATURES.key, CONFIG_SCHEMA.FEATURES.defaultValue),
        env: workspaceConfiguration.get<Record<string, string>>(CONFIG_SCHEMA.ENV_VARIABLES.key, CONFIG_SCHEMA.ENV_VARIABLES.defaultValue),
        debugEnv: workspaceConfiguration.get<Record<string, string>>(CONFIG_SCHEMA.DEBUG_ENV_VARIABLES.key, CONFIG_SCHEMA.DEBUG_ENV_VARIABLES.defaultValue),
        cliOptions: workspaceConfiguration.get<readonly string[]>(CONFIG_SCHEMA.CLI_OPTIONS.key, CONFIG_SCHEMA.CLI_OPTIONS.defaultValue),
        cwd: workspaceConfiguration.get<string>(CONFIG_SCHEMA.CWD.key, CONFIG_SCHEMA.CWD.defaultValue).trim() || vscode.workspace.workspaceFolders![0].uri.fsPath,
        cucumberPath: workspaceConfiguration.get<string>(CONFIG_SCHEMA.CUCUMBER_PATH.key, CONFIG_SCHEMA.CUCUMBER_PATH.defaultValue).trim(),
    };
}
