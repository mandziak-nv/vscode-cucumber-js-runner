import * as vscode from 'vscode';
import { CucumberRunner } from '../cucumber/CucumberRunner';
import TestCase from '../testTree/TestCase';
import TestFile from '../testTree/TestFile';
import { testItemDataMap } from '../other';

export const startTestRun = async (controller: vscode.TestController, request: vscode.TestRunRequest, token: vscode.CancellationToken, debug: boolean = false) => {
    const testRun = controller.createTestRun(request);

    token.onCancellationRequested(() => {
        CucumberRunner.killCucumberProcess();
        testRun.appendOutput('Run instance cancelled.\r\n\n');
    });

    const initialTests = request.include ?? gatherTestItems(controller.items);
    const testQueue = await discoverTests(initialTests);
    await runTestQueue(testQueue);

    async function discoverTests(testItems: Iterable<vscode.TestItem>): Promise<{ testItem: vscode.TestItem; testCase: TestCase; }[]> {
        const testQueue: { testItem: vscode.TestItem; testCase: TestCase }[] = [];
        for (const testItem of testItems) {
            if (request.exclude?.includes(testItem)) {
                continue;
            }

            const testItemData = testItemDataMap.get(testItem);
            if (testItemData instanceof TestCase) {
                testRun.enqueued(testItem);
                testQueue.push({ testItem: testItem, testCase: testItemData });
            } else {
                if (testItemData instanceof TestFile && !testItemData.didResolve) {
                    await testItemData.updateFromDisk(controller, testItem);
                }
                testQueue.push(...(await discoverTests(gatherTestItems(testItem.children))));
            }
        }
        return testQueue;
    }

    async function runTestQueue(testQueue: { testItem: vscode.TestItem; testCase: TestCase }[]): Promise<void> {
        for (const { testItem, testCase } of testQueue) {
            if (!token.isCancellationRequested) {
                testRun.started(testItem);
                const testResults = await runTest(testCase);
                processTestResults(testItem, testCase, testResults);
            } else {
                testRun.skipped(testItem);
            }
        }
        testRun.end();
    }

    async function runTest(testCase: TestCase): Promise<string[]> {
        testRun.appendOutput(`Running test: ${testCase.name}\r\n`);
        const cucumberOutput = await CucumberRunner.runTest(testRun, testCase.name, debug);
        if (!token.isCancellationRequested) {
            testRun.appendOutput('Finished running test!\r\n\n');
        }
        return cucumberOutput;
    }

    async function processTestResults(testItem: vscode.TestItem, testCase: TestCase, cucumberOutput: string[]): Promise<string> {
        let status: string = 'errored';
        let errorMessage: string | undefined;
        let stepsPassed: number = 0;
        let executionTime: number | undefined;

        for (let i = 0; i < cucumberOutput.length; i++) {
            const cucumberOutputLine = cucumberOutput[i].trim();

            if (cucumberOutputLine === 'Failures:') {
                if (i + 1 < cucumberOutput.length) {
                    const failure = cucumberOutput[i + 1]
                        .trim().match(/\ +[✖?]\ .+?\n(.+?)(?=\n\ +[-✔]\ (?:Given|When|Then|And|But|After))/s);
                    if (failure) {
                        errorMessage = failure[1];
                    }
                }
            } else if (/\d+m\d+\.\d+s\ \(executing\ steps:\ \d+m\d+\.\d+s\)/.test(cucumberOutputLine)) {
                if (/^0/.test(cucumberOutputLine)) {
                    status = 'errored';
                    errorMessage = `Scenario with name "Scenario: ${testCase.name}" not found ¯\\_(ツ)_/¯`;
                } else if (/^[2-9]/.test(cucumberOutputLine)) {
                    if (testCase.isOutline) {
                        const [scenarioStatusString, , executionTimeString] = cucumberOutputLine.split('\n');
                        if (/\d+ scenarios? \(\d+ passed\)/.test(scenarioStatusString)) {
                            status = 'passed';
                        } else if (/\d+ scenarios? \(\d+ skipped\)/.test(scenarioStatusString)) {
                            status = 'skipped';
                        } else {
                            status = 'failed';
                        }
                        const [totalExecutionTimeString, stepsExecutionTimeString] = executionTimeString.match(/\d+m\d+\.\d+s/g)!;
                        const [, totalExecutionMinutes, totalExecutionSeconds] = /(\d+)m([\d.]+)s/.exec(totalExecutionTimeString)!;
                        executionTime = Number(totalExecutionMinutes) * 60 + Number(totalExecutionSeconds);
                        errorMessage = 'Outline scenario failed. Please check logs for more information';
                    } else {
                        status = 'errored';
                        errorMessage = `Found multiple scenarios with name "Scenario: ${testCase.name}" ¯\\_(ツ)_/¯`;
                    }
                } else {
                    const [scenarioStatusString, stepsStatusString, executionTimeString] = cucumberOutputLine.split('\n');
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

        switch (status) {
            case 'passed':
                testRun.passed(testItem, executionTime);
                break;
            case 'errored':
                const errorMsg = new vscode.TestMessage(errorMessage || 'Unknown error! Please check logs for more information');
                errorMsg.location = new vscode.Location(testItem.uri!, testItem.range!.end);
                testRun.errored(testItem, errorMsg);
                break;
            case 'skipped':
                testRun.skipped(testItem);
                break;
            default:
                const failMsg = new vscode.TestMessage(errorMessage || 'Unknown error! Please check logs for more information');
                failMsg.location = new vscode.Location(testItem.uri!, testItem.range!.end.translate(stepsPassed + 1));
                testRun.failed(testItem, failMsg, executionTime);
                break;
        }

        return status;
    }

    function gatherTestItems(testItemCollection: vscode.TestItemCollection): vscode.TestItem[] {
        const testItems: vscode.TestItem[] = [];
        testItemCollection.forEach(item => testItems.push(item));
        return testItems;
    }
};
