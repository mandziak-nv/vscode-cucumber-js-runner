import * as vscode from 'vscode';

const CONFIG_MIGRATIONS = [
    { oldKey: 'features', newKey: 'features' },
    { oldKey: 'env_variables', newKey: 'env' },
    { oldKey: 'debug_env_variables', newKey: 'debugEnv' },
    { oldKey: 'cli_options', newKey: 'cliArgs' },
    { oldKey: 'cwd', newKey: 'cwd' },
    { oldKey: 'cucumber_path', newKey: 'cucumberExecutable' },
] as const;

function migrateConfigOption(oldConfig: vscode.WorkspaceConfiguration, newConfig: vscode.WorkspaceConfiguration, oldKey: string, newKey: string): boolean {
    let migrated = false;
    const configOption = oldConfig.inspect(oldKey);
    if (configOption?.globalValue) {
        newConfig.update(newKey, configOption.globalValue, vscode.ConfigurationTarget.Global);
        oldConfig.update(oldKey, undefined, vscode.ConfigurationTarget.Global);
        migrated = true;
    }
    if (configOption?.workspaceValue) {
        newConfig.update(newKey, configOption.workspaceValue, vscode.ConfigurationTarget.Workspace);
        oldConfig.update(oldKey, undefined, vscode.ConfigurationTarget.Workspace);
        migrated = true;
    }
    if (configOption?.workspaceFolderValue) {
        newConfig.update(newKey, configOption.workspaceFolderValue, vscode.ConfigurationTarget.WorkspaceFolder);
        oldConfig.update(oldKey, undefined, vscode.ConfigurationTarget.WorkspaceFolder);
        migrated = true;
    }
    return migrated;
}

export function migrateOldConfig() {
    const oldConfig = vscode.workspace.getConfiguration('cucumber_runner',);
    const newConfig = vscode.workspace.getConfiguration('cucumberJsRunner');

    const migrated = CONFIG_MIGRATIONS.filter(({ oldKey, newKey }) =>
        migrateConfigOption(oldConfig, newConfig, oldKey, newKey)
    ).length > 0;

    if (migrated) {
        vscode.window.showInformationMessage(
            "Cucumber JS Test Runner now uses a new configuration format. Your settings were migrated automatically. Please review them to ensure they are correct."
        );
    }
}
