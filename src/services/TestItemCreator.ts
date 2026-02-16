import * as vscode from 'vscode';
import { getTestFilePatterns } from './TestFilePatternProvider';
import { resolveTestItemChildren } from './TestItemResolver';
import TestFile from '../models/TestFile';

import { TEST_ITEM_DATA_MAP } from '../state/global';

export function getOrCreateTestItemForFile(controller: vscode.TestController, uri: vscode.Uri): { item: vscode.TestItem; itemData: TestFile; } {
    const existingItem = controller.items.get(uri.toString());
    if (existingItem) return { item: existingItem, itemData: TEST_ITEM_DATA_MAP.get(existingItem) as TestFile };

    const newItem = controller.createTestItem(uri.toString(), uri.path.split('/').at(-1) || uri.path, uri);
    const itemData = new TestFile();
    TEST_ITEM_DATA_MAP.set(newItem, itemData);
    newItem.canResolveChildren = true;
    controller.items.add(newItem);
    return { item: newItem, itemData: itemData };
}

export async function createInitialTestItems(controller: vscode.TestController): Promise<void> {
    for (const pattern of getTestFilePatterns()) {
        for (const uri of await vscode.workspace.findFiles(pattern)) {
            const { item, itemData } = getOrCreateTestItemForFile(controller, uri);
            await resolveTestItemChildren(controller, item);
        }
    };
}

export function clearTestItems(testController: vscode.TestController): void {
    testController.items.forEach((item: vscode.TestItem, collection: vscode.TestItemCollection) => collection.delete(item.id));
}

export async function reloadTestItems(testController: vscode.TestController): Promise<void> {
    clearTestItems(testController);
    await createInitialTestItems(testController);
}
