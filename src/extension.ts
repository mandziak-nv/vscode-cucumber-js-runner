import * as vscode from 'vscode';
import { findInitialFiles, getOrCreateFile, getWorkspaceTestPatterns, startWatchingWorkspace, testItemDataMap } from './other';
import { startTestRun } from './functions/startTestRun';
import TestFile from './testTree/TestFile';

export async function activate(context: vscode.ExtensionContext) {
	const testController = vscode.tests.createTestController('cucumberTestController', 'Cucumber Tests');

	testController.refreshHandler = async () => {
		testController.items.forEach((item, collection) => collection.delete(item.id));
		await Promise.all(getWorkspaceTestPatterns().map((pattern) => findInitialFiles(testController, pattern)));
	};

	const runHandler = (request: vscode.TestRunRequest, token: vscode.CancellationToken) => {
		startTestRun(testController, request, token);
	};

	testController.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true, undefined, false);

	const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();

	testController.resolveHandler = async (item) => {
		if (!item) {
			context.subscriptions.push(...startWatchingWorkspace(testController, fileChangedEmitter));
			return;
		}

		const testItemData = testItemDataMap.get(item);
		if (testItemData instanceof TestFile) {
			await testItemData.updateFromDisk(testController, item);
		}
	};

	context.subscriptions.push(testController);

	function updateNodeForDocument(document: vscode.TextDocument) {
		if (document.uri.scheme === 'file' && document.uri.path.endsWith('.feature')) {
			const { file, data } = getOrCreateFile(testController, document.uri);
			data.updateFromContents(testController, file, document.getText());
		}
	}

	for (const document of vscode.workspace.textDocuments) {
		updateNodeForDocument(document);
	}

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(updateNodeForDocument),
		vscode.workspace.onDidChangeTextDocument(e => updateNodeForDocument(e.document)),
	);
}
