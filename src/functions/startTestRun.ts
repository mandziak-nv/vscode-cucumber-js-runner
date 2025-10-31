import * as vscode from 'vscode';
import { CucumberRunner } from '../cucumber/CucumberRunner';
import TestCase from '../testTree/TestCase';
import TestFile from '../testTree/TestFile';
import { testItemDataMap } from '../other';

export const startTestRun = async (controller: vscode.TestController, request: vscode.TestRunRequest, token: vscode.CancellationToken) => {
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
        const cucumberOutput = await CucumberRunner.runTest(testRun, testCase.name);
        if (!token.isCancellationRequested) {
            testRun.appendOutput('Finished running test!\r\n\n');
        }
        return cucumberOutput;
    }

    async function processTestResults(testItem: vscode.TestItem, testCase: TestCase, cucumberOutput: string[]): Promise<string> {
        let status: string = 'errored';
        let errorMessage: string | undefined;
        let stepsPassed: number = 0;
        let stepsTotal: number = 0;
        let executionTime: number | undefined;
        let examplesPassed: number = 0;
        let examplesTotal: number = 0;

        for (let i = 0; i < cucumberOutput.length; i++) {
            const cucumberOutputLine = cucumberOutput[i].trim().replace(/\x1b\[[0-9;]*m/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
            
            if (cucumberOutputLine.includes('Failures:')) {
                const failureMessage = cucumberOutput.join('\n').split('Failures:')[1];
                errorMessage = failureMessage;
                status = 'failed';
                break;
            } else if (/\d+m\d+\.\d+s\ \(executing\ steps:\ \d+m\d+\.\d+s\)/.test(cucumberOutputLine)) {
                const scenarioMatch = cucumberOutputLine.match(/(\d+) scenarios?: (\d+) passed, (\d+) failed, (\d+) skipped/);
                const stepMatch = cucumberOutputLine.match(/(\d+) steps?: (\d+) passed, (\d+) failed, (\d+) skipped/);
                
                if (scenarioMatch) {
                    examplesTotal = Number(scenarioMatch[1]);
                    examplesPassed = Number(scenarioMatch[2]);
                }

                if (stepMatch) {
                    stepsTotal = Number(stepMatch[1]);
                    stepsPassed = Number(stepMatch[2]);
                }

                // Determine overall status based on scenarios and steps
                if (examplesPassed === examplesTotal && stepsPassed === stepsTotal) {
                    status = 'passed';
                } else if (examplesPassed === 0 || stepsPassed === 0) {
                    status = 'failed';
                } else {
                    status = 'failed';
                    errorMessage = `${examplesTotal - examplesPassed} out of ${examplesTotal} examples failed, ` +
                                   `${stepsTotal - stepsPassed} out of ${stepsTotal} steps failed`;
                }

                const executionTimeMatch = cucumberOutputLine.match(/(\d+)m([\d.]+)s/);
                if (executionTimeMatch) {
                    const minutes = Number(executionTimeMatch[1]);
                    const seconds = Number(executionTimeMatch[2]);
                    executionTime = minutes * 60 + seconds;
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
            case 'failed':
                const failMsg = new vscode.TestMessage(errorMessage || 
                    `${examplesTotal - examplesPassed} out of ${examplesTotal} examples failed, ` +
                    `${stepsTotal - stepsPassed} out of ${stepsTotal} steps failed`
                );
                failMsg.location = new vscode.Location(testItem.uri!, testItem.range!.end);
                testRun.failed(testItem, failMsg, executionTime);
                break;
            default:
                const failMsg = new vscode.TestMessage(errorMessage || 'Unknown error! Please check logs for more information');
                failMsg.location = new vscode.Location(testItem.uri!, testCase.startLine.translate(stepsPassed + 1));
        }

        return status;
    }

    function gatherTestItems(testItemCollection: vscode.TestItemCollection): vscode.TestItem[] {
        const testItems: vscode.TestItem[] = [];
        testItemCollection.forEach(item => testItems.push(item));
        return testItems;
    }
};
