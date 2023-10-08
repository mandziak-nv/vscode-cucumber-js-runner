import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { getExtensionConfiguration } from './extensionConfiguration';
import { TestFile, testData } from './testTree';

const textDecoder = new TextDecoder('utf-8');

function getTextDecoder(): TextDecoder {
    return textDecoder;
}

export function getWorkspaceTestPatterns() {
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
    const existing = controller.items.get(uri.toString());
    if (existing) {
        return { file: existing, data: testData.get(existing) as TestFile };
    }

    const file = controller.createTestItem(uri.toString(), uri.path.split('/').pop()!, uri);
    controller.items.add(file);

    const data = new TestFile(getTextDecoder());
    testData.set(file, data);

    file.canResolveChildren = true;
    return { file, data };
}

export const getContentFromFilesystem = async (uri: vscode.Uri) => {
    try {
        const rawContent = await vscode.workspace.fs.readFile(uri);
        return getTextDecoder().decode(rawContent);
    } catch (e) {
        console.warn(`Error providing tests for ${uri.fsPath}`, e);
        return '';
    }
}

export function gatherTestItems(collection: vscode.TestItemCollection) {
    const items: vscode.TestItem[] = [];
    collection.forEach(item => items.push(item));
    return items;
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