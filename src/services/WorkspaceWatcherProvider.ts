import * as vscode from 'vscode';
import { getTestFilePatterns } from './TestFilePatternProvider';
import { getOrCreateTestItemForFile } from './TestItemCreator';
import { resolveTestItemChildren } from './TestItemResolver';

function isWorkspaceWatcher(object: any): object is vscode.FileSystemWatcher {
    return 'onDidCreate' in object && 'onDidChange' in object && 'onDidDelete' in object;
}

function createWorkspaceWatcher(controller: vscode.TestController, pattern: vscode.GlobPattern): vscode.FileSystemWatcher {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate((uri: vscode.Uri) => {
        getOrCreateTestItemForFile(controller, uri);
    });
    watcher.onDidChange(async (uri: vscode.Uri) => {
        const { item, itemData } = getOrCreateTestItemForFile(controller, uri);
        if (itemData.isResolved) {
            await resolveTestItemChildren(controller, item);
        }
    });
    watcher.onDidDelete((uri: vscode.Uri) => {
        controller.items.delete(uri.toString());
    });
    return watcher;
}

export function createWorkspaceWatchers(controller: vscode.TestController, arr: unknown[]): void {
    arr.push(...getTestFilePatterns().map(pattern => createWorkspaceWatcher(controller, pattern)));
}

export function disposeWorkspaceWatchers(arr: unknown[]): void {
    for (let i = arr.length - 1; i >= 0; i--) {
        const w = arr[i];
        if (isWorkspaceWatcher(w)) {
            w.dispose();
            arr.splice(i, 1);
        }
    }
}

export function reloadWorkspaceWatchers(controller: vscode.TestController, arr: unknown[]): void {
    disposeWorkspaceWatchers(arr);
    createWorkspaceWatchers(controller, arr);
}
