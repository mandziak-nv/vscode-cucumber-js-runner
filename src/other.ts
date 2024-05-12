import * as vscode from 'vscode';
import { getExtensionConfiguration } from './configuration/getExtensionConfiguration';
import TestCase from './testTree/TestCase';
import TestFile from './testTree/TestFile';
import TestSuite from './testTree/TestSuite';

export const testItemDataMap = new WeakMap<vscode.TestItem, TestFile | TestSuite | TestCase>();

export function getWorkspaceTestPatterns(): vscode.RelativePattern[] {
    if (!vscode.workspace.workspaceFolders) {
        return [];
    }
    const cwd = vscode.workspace.workspaceFolders[0];
    const { featurePaths } = getExtensionConfiguration();
    return featurePaths.map(pattern => (new vscode.RelativePattern(cwd, pattern)));
}

export async function findInitialFiles(controller: vscode.TestController, pattern: vscode.GlobPattern) {
    for (const uri of await vscode.workspace.findFiles(pattern)) {
        getOrCreateFile(controller, uri);
    }
}

export function getOrCreateFile(controller: vscode.TestController, uri: vscode.Uri) {
    const existingTestItem = controller.items.get(uri.toString());
    if (existingTestItem) {
        return { file: existingTestItem, data: testItemDataMap.get(existingTestItem) as TestFile };
    }

    const newTestItem = controller.createTestItem(uri.toString(), uri.path.split('/').pop()!, uri);
    controller.items.add(newTestItem);

    const testItemData = new TestFile();
    testItemDataMap.set(newTestItem, testItemData);

    newTestItem.canResolveChildren = true;
    return { file: newTestItem, data: testItemData };
}

export function startWatchingWorkspace(controller: vscode.TestController, fileChangedEmitter: vscode.EventEmitter<vscode.Uri>) {
    return getWorkspaceTestPatterns().map((pattern) => {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        watcher.onDidCreate(uri => {
            getOrCreateFile(controller, uri);
            fileChangedEmitter.fire(uri);
        });
        watcher.onDidChange(async uri => {
            const { file, data } = getOrCreateFile(controller, uri);
            if (data.didResolve) {
                await data.updateFromDisk(controller, file);
            }
            fileChangedEmitter.fire(uri);
        });
        watcher.onDidDelete(uri => controller.items.delete(uri.toString()));

        findInitialFiles(controller, pattern);

        return watcher;
    });
}
