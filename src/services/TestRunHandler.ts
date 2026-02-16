import * as vscode from 'vscode';
import { resolveTestItemChildren } from './TestItemResolver';
import { CucumberRunner } from '../runners/CucumberRunner';
import TestCase from '../models/TestCase';
import TestFile from '../models/TestFile';

import { TEST_ITEM_DATA_MAP } from '../state/global';

function gatherTestItems(collection: vscode.TestItemCollection): vscode.TestItem[] {
    const items: vscode.TestItem[] = [];
    collection.forEach(item => items.push(item));
    return items;
}

async function collectTestsToRun(controller: vscode.TestController, run: vscode.TestRun, itemsInclude: ReadonlyArray<vscode.TestItem>, itemsExclude?: ReadonlyArray<vscode.TestItem>): Promise<{ item: vscode.TestItem; itemData: TestCase; }[]> {
    const testQueue: { item: vscode.TestItem; itemData: TestCase }[] = [];
    for (const item of itemsInclude) {
        if (itemsExclude?.includes(item)) {
            continue;
        }

        const itemData = TEST_ITEM_DATA_MAP.get(item);
        if (itemData instanceof TestCase) {
            run.enqueued(item);
            testQueue.push({ item, itemData });
        } else {
            if (itemData instanceof TestFile && !itemData.isResolved) {
                await resolveTestItemChildren(controller, item);
            }
            testQueue.push(...(await collectTestsToRun(controller, run, gatherTestItems(item.children), itemsExclude)));
        }
    }
    return testQueue;
}

function parseTestStatus(cucumberOutput: string[]): { status: string; executionTime: number } {
    let status: string = 'unknown';
    let executionTime: number = 0;

    for (const cucumberOutputLine of cucumberOutput) {
        const line = cucumberOutputLine.trim()
            .replace(/\x1b\[[0-9;]*m/g, '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '');

        if (line.startsWith('1 scenario (1 ')) {
            const [scenarioStatusString, _stepsStatusString, executionTimeString] = line.split('\n');

            const statusMatch = scenarioStatusString.match(/^1 scenario \(1 (.+)\)/);
            if (statusMatch) status = statusMatch[1];

            const timeMatch = executionTimeString.match(/^(\d+)m([\d.]+)s/);
            if (timeMatch) executionTime = (Number(timeMatch[1]) * 60 + Number(timeMatch[2])) * 1000;
        } else if (line.startsWith('0 scenarios\n0 steps')) {
            status = 'skipped';
        }
    }
    return { status, executionTime };
}

function createFailureMessage(item: vscode.TestItem, output: string): vscode.TestMessage {
    const message = new vscode.TestMessage((output.split('Failures:')[1] ?? output).trim());
    if (item.uri && item.range) {
        message.location = new vscode.Location(item.uri, item.range.end);
    }
    return message;
}

function setTestResult(run: vscode.TestRun, item: vscode.TestItem, status: string, executionTime: number, output: string): void {
    if (status === 'passed') {
        run.passed(item, executionTime);
    } else if (status === 'skipped' || status === 'pending') {
        run.skipped(item);
    } else {
        const message = createFailureMessage(item, output);
        if (status === 'failed') {
            run.failed(item, message, executionTime);
        } else if (status === 'undefined' || status === 'ambiguous') {
            run.errored(item, message, executionTime);
        } else {
            run.errored(item, message, executionTime);
        }
    }
}

export async function startTestRun(controller: vscode.TestController, request: vscode.TestRunRequest, token: vscode.CancellationToken, debug: boolean = false): Promise<void> {
    const run = controller.createTestRun(request);

    token.onCancellationRequested((e: any) => {
        CucumberRunner.killCucumberProcess();
        run.appendOutput('\r\n\nRun instance cancelled!\r\n\n');
    });

    const queue = await collectTestsToRun(controller, run, request.include ?? gatherTestItems(controller.items), request.exclude);
    for (const { item, itemData } of queue) {
        if (!token.isCancellationRequested) {
            run.started(item);
            run.appendOutput(`Running test: ${itemData.name}\r\n`);
            const cucumberOutput = await CucumberRunner.runLine(run, itemData.path, debug);
            if (!token.isCancellationRequested) {
                const { status, executionTime } = parseTestStatus(cucumberOutput);
                setTestResult(run, item, status, executionTime, cucumberOutput.join(''));
                run.appendOutput('Finished running test!\r\n\n');
            }
        }
    }

    run.end();
};
