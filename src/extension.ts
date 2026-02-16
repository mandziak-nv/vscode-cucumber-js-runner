import * as vscode from 'vscode';
import { createInitialTestItems, reloadTestItems } from './services/TestItemCreator';
import { resolveTestItemChildren } from './services/TestItemResolver';
import { createWorkspaceWatchers, reloadWorkspaceWatchers } from './services/WorkspaceWatcherProvider';
import { startTestRun } from './services/TestRunHandler';
import { CONFIG_NAME, CONFIG_SCHEMA } from './configuration/configuration';
import { migrateOldConfig } from './services/ConfigMigration';

export async function activate(context: vscode.ExtensionContext) {
	migrateOldConfig();

	const controller = vscode.tests.createTestController('CUCUMBER_JS_TEST_CONTROLLER', 'Cucumber JS Test Runner');

	const resolveHandler = async (item?: vscode.TestItem) => {
		if (item) {
			await resolveTestItemChildren(controller, item);
		}
	};
	controller.resolveHandler = resolveHandler;

	const refreshHandler = async (token: vscode.CancellationToken) => {
		await reloadTestItems(controller);
	};
	controller.refreshHandler = refreshHandler;

	const runHandler = (request: vscode.TestRunRequest, token: vscode.CancellationToken) => {
		startTestRun(controller, request, token, false);
	};
	controller.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true, undefined, false);

	const debugHandler = (request: vscode.TestRunRequest, token: vscode.CancellationToken) => {
		startTestRun(controller, request, token, true);
	};
	controller.createRunProfile('Debug Tests', vscode.TestRunProfileKind.Debug, debugHandler, true, undefined, false);

	context.subscriptions.push(controller);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
			if (e.affectsConfiguration(`${CONFIG_NAME}.${CONFIG_SCHEMA.FEATURES.key}`)
				|| (e.affectsConfiguration(`${CONFIG_NAME}.${CONFIG_SCHEMA.CWD.key}`))) {
				await reloadTestItems(controller);
				reloadWorkspaceWatchers(controller, context.subscriptions);
			}
		})
	);

	await createInitialTestItems(controller);

	createWorkspaceWatchers(controller, context.subscriptions);
}
