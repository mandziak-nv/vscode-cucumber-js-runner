import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import TestCase from './TestCase';
import TestSuite from './TestSuite';
import { testItemDataMap } from '../other';

export default class TestFile {
    private static readonly textDecoder = new TextDecoder('utf-8');

    private _didResolve = false;

    get didResolve(): boolean {
        return this._didResolve;
    }

    public async updateFromDisk(controller: vscode.TestController, item: vscode.TestItem): Promise<void> {
        try {
            const fileContent = TestFile.textDecoder.decode(await vscode.workspace.fs.readFile(item.uri!));
            item.error = undefined;
            this.updateFromContents(controller, item, fileContent);
        } catch (e) {
            item.error = (e as Error).stack;
        }
    }

    public updateFromContents(
        controller: vscode.TestController,
        item: vscode.TestItem,
        content: string
    ): void {
        const scenarioRe = /^\s*Scenario(?: Outline)?:\s*(.+)$/;
        const featureRe = /^\s*Feature:\s*(.+)$/;
        const examplesRe = /^\s*Examples:\s*(.*)$/;
        const examplesRowRe = /^\s*\|((.+)\|)*\s*$/;
        
        let featureTestItem: vscode.TestItem | undefined;
        let scenarioTestItem: vscode.TestItem | undefined;
        let isExamplesLine: boolean = false;
        let exampleHeaders: string[] | undefined;
        let lastScenarioName: string | undefined;

        const lines = content.split("\n");

        for (let lineNo = 0; lineNo < lines.length; lineNo++) {
            const line = lines[lineNo];
            const feature = !featureTestItem && featureRe.exec(line);
            if (feature) {
                const [, name] = feature;
                const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, line.length));
                const testItem = controller.createTestItem(`${item.uri}/${name}`, name, item.uri);
                testItem.range = range;
                testItemDataMap.set(testItem, new TestSuite());
                featureTestItem = testItem;
                isExamplesLine = false;
                continue;
            }

            const scenario = scenarioRe.exec(line);
            if (scenario) {
                const [, name] = scenario;
                const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, line.length));
                const isTestCaseOutline = /^\s*Scenario Outline:/.test(line);
                const testItem = controller.createTestItem(`${item.uri}/${name}`, name, item.uri);
                testItem.range = range;
                if (isTestCaseOutline) {
                    testItemDataMap.set(testItem, new TestSuite());
                } else {
                    testItemDataMap.set(
                        testItem,
                        new TestCase(name, isTestCaseOutline, testItem.range!.end)
                    );
                }
                featureTestItem?.children.add(testItem);
                lastScenarioName = name;
                scenarioTestItem = testItem;
                isExamplesLine = false;
                continue;
            }

            const examples = examplesRe.exec(line);
            if (examples) {
                isExamplesLine = true;
                continue;
            }

            if (isExamplesLine) {
                const exampleLine = examplesRowRe.exec(line);
                if (exampleLine) {
                    const [, , rawHeaders] = exampleLine;
                    const lineData = rawHeaders.split("|").map((header) => header.trim());
                    if (!exampleHeaders) {
                        exampleHeaders = lineData;
                    } else {
                        let exampleScenarioName = lastScenarioName!;
                        exampleHeaders.forEach((header, index) => {
                            exampleScenarioName = exampleScenarioName?.replace(`<${header}>`, lineData[index]);
                        });

                        const name = exampleScenarioName;
                        const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, line.length));
                        const testItem = controller.createTestItem(`${item.uri}/${name}`, name, item.uri);
                        testItem.range = range;
                        testItemDataMap.set(testItem, new TestCase(name, false, scenarioTestItem!.range!.end));
                        scenarioTestItem?.children.add(testItem);
                    }
                    continue;
                }
                continue;
            }
        }

        if (featureTestItem) {
            item.children.replace([featureTestItem]);
        }

        this._didResolve = true;
    }
}
