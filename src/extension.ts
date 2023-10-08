import * as vscode from 'vscode';
import { TestCase, testData, TestFile } from './testTree';
import { CucumberRunner } from './cucumberController';
import { getContentFromFilesystem, findInitialFiles, gatherTestItems, getOrCreateFile, getWorkspaceTestPatterns, startWatchingWorkspace } from './other';

export async function activate(context: vscode.ExtensionContext) {
	const ctrl = vscode.tests.createTestController('cucumberTestController', 'Cucumber Tests');
	context.subscriptions.push(ctrl);

	ctrl.refreshHandler = async () => {
		ctrl.items.forEach((item, collection) => collection.delete(item.id));
		await Promise.all(getWorkspaceTestPatterns().map((pattern) => findInitialFiles(ctrl, pattern)));
	};

	const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();

	const runHandler = (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) => {
		if (!request.continuous) {
			return startTestRun(request);
		}

		const l = fileChangedEmitter.event(uri => {
			startTestRun(new vscode.TestRunRequest([getOrCreateFile(ctrl, uri).file], undefined, request.profile, true));
		});
		cancellation.onCancellationRequested(() => l.dispose());
	};
	ctrl.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true, undefined, true);

	// const debugHandler = (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) => {
	// 	if (!request.continuous) {
	// 		return startTestRun(request, true);
	// 	}

	// 	const l = fileChangedEmitter.event(uri => {
	// 		startTestRun(new vscode.TestRunRequest([getOrCreateFile(ctrl, uri).file], undefined, request.profile, true), true);
	// 	});
	// 	cancellation.onCancellationRequested(() => l.dispose());
	// };
	// ctrl.createRunProfile('Debug Tests', vscode.TestRunProfileKind.Debug, debugHandler, true, undefined, true);

	ctrl.resolveHandler = async item => {
		if (!item) {
			context.subscriptions.push(...startWatchingWorkspace(ctrl, fileChangedEmitter));
			return;
		}

		const data = testData.get(item);
		if (data instanceof TestFile) {
			await data.updateFromDisk(ctrl, item);
		}
	};

	let runState = false;
	const cucumberRunner = new CucumberRunner();

	const startTestRun = (request: vscode.TestRunRequest, debug?: boolean) => {
		if (!runState) {
			runState = true;
			const queue: { test: vscode.TestItem; data: TestCase }[] = [];

			const testRun = ctrl.createTestRun(request);

			testRun.token.onCancellationRequested(() => {
				cucumberRunner.killCucumberProcess();
				runState = false;
			});

			const runTestQueue = async () => {
				for (const { test, data } of queue) {
					if (testRun.token.isCancellationRequested) {
						testRun.skipped(test);
					} else {
						testRun.started(test);
						testRun.appendOutput(`Scenario: "${data.name}"\r\n\n`);
						await runTestItem(test, data);
					}

					const lineNo = test.range!.start.line;
					const fileCoverage = coveredLines.get(test.uri!.toString());
					if (fileCoverage) {
						fileCoverage[lineNo]!.executionCount++;
					}
				}
				testRun.end();
				runState = false;
			};

			const runTestItem = async (item: vscode.TestItem, testCase: TestCase): Promise<void> => {
				let status: string = 'errored';
				let errorMessage: string | null = null;
				let stepsPassed: number = 0;
				let executionTime: number = 0;

				const cucumberLogs = await cucumberRunner.runTest(testCase.name, testRun, debug);
				cucumberRunner.killCucumberProcess();

				for (let i = 0; i < cucumberLogs.length; i++) {
					const cucumberLog = cucumberLogs[i].trim();

					if (cucumberLog === 'Failures:') {
						if (i + 1 < cucumberLogs.length) {
							const failure = cucumberLogs[i + 1].trim().match(/\ +[✖?]\ .+?\n(.+?)(?=\n\ +[-✔]\ (?:Given|When|Then|And|But|After))/s);
							if (failure) {
								errorMessage = failure[1];
							}
						}
					} else if (/\d+m\d+\.\d+s\ \(executing\ steps:\ \d+m\d+\.\d+s\)/.test(cucumberLog)) {
						if (/^0/.test(cucumberLog)) {
							status = 'errored';
							errorMessage = `Scenario with name "Scenario: ${testCase.name}" not found ¯\\_(ツ)_/¯`;
						} else if (/^[2-9]/.test(cucumberLog)) {
							status = 'errored';
							errorMessage = `Found multiple scenarios with name "Scenario: ${testCase.name}" ¯\\_(ツ)_/¯`;
						} else {
							const [scenarioStatusString, stepsStatusString, executionTimeString] = cucumberLog.split('\n');
							const scenarioStatus = scenarioStatusString.match(/scenario \(1 (.+)\)/);
							if (scenarioStatus) {
								status = scenarioStatus[1];
							} else {
								status = 'errored';
							}
							const stepsStatus = stepsStatusString.match(/(\d+) passed/);
							if (stepsStatus) {
								stepsPassed = Number(stepsStatus[1]);
							} else {
								stepsPassed = 0;
							}
							const [totalExecutionTimeString, stepsExecutionTimeString] = executionTimeString.match(/\d+m\d+\.\d+s/g)!;
							const [, totalExecutionMinutes, totalExecutionSeconds] = /(\d+)m([\d.]+)s/.exec(totalExecutionTimeString)!;
							executionTime = Number(totalExecutionMinutes) * 60 + Number(totalExecutionSeconds);
						}
					}
				}
				if (testRun.token.isCancellationRequested) {
					testRun.skipped(item);
				} else {
					switch (status) {
						case 'passed':
							testRun.passed(item, executionTime);
							break;
						case 'errored':
							const errorMsg = new vscode.TestMessage(errorMessage || 'Unknown error! Please check logs for more information');
							errorMsg.location = new vscode.Location(item.uri!, item.range!.end);
							testRun.errored(item, errorMsg);
							break;
						case 'skipped':
							testRun.skipped(item);
							break;
						default:
							const failMsg = new vscode.TestMessage(errorMessage || 'Unknown error! Please check logs for more information');
							failMsg.location = new vscode.Location(item.uri!, item.range!.end.translate(stepsPassed + 1));
							testRun.failed(item, failMsg, executionTime);
							break;
					}
				}
			};

			const coveredLines = new Map<string, (vscode.StatementCoverage | undefined)[]>();

			const discoverTests = async (tests: Iterable<vscode.TestItem>) => {
				for (const test of tests) {
					if (request.exclude?.includes(test)) {
						continue;
					}

					const data = testData.get(test);
					if (data instanceof TestCase) {
						testRun.enqueued(test);
						queue.push({ test, data });
					} else {
						if (data instanceof TestFile && !data.didResolve) {
							await data.updateFromDisk(ctrl, test);
						}

						await discoverTests(gatherTestItems(test.children));
					}

					if (test.uri && !coveredLines.has(test.uri.toString())) {
						try {
							const lines = (await getContentFromFilesystem(test.uri)).split('\n');
							coveredLines.set(
								test.uri.toString(),
								lines.map((lineText, lineNo) =>
									lineText.trim().length ? new vscode.StatementCoverage(0, new vscode.Position(lineNo, 0)) : undefined
								)
							);
						} catch {

						}
					}
				}
			};

			testRun.coverageProvider = {
				provideFileCoverage() {
					const coverage: vscode.FileCoverage[] = [];
					for (const [uri, statements] of coveredLines) {
						coverage.push(
							vscode.FileCoverage.fromDetails(
								vscode.Uri.parse(uri),
								statements.filter((s): s is vscode.StatementCoverage => !!s)
							)
						);
					}

					return coverage;
				},
			};

			discoverTests(request.include ?? gatherTestItems(ctrl.items)).then(runTestQueue);
		}
	};

	function updateNodeForDocument(e: vscode.TextDocument) {
		if (e.uri.scheme !== 'file') {
			return;
		}

		if (!e.uri.path.endsWith('.feature')) {
			return;
		}

		const { file, data } = getOrCreateFile(ctrl, e.uri);
		data.updateFromContents(ctrl, e.getText(), file);
	}

	for (const document of vscode.workspace.textDocuments) {
		updateNodeForDocument(document);
	}

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(updateNodeForDocument),
		vscode.workspace.onDidChangeTextDocument(e => updateNodeForDocument(e.document)),
	);
}