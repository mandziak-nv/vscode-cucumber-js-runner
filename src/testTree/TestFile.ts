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

    public updateFromContents(controller: vscode.TestController, item: vscode.TestItem, content: string): void {
        const scenarioRe = /^\s*Scenario(?: Outline)?:\s*(.+)$/;
        const featureRe = /^\s*Feature:\s*(.+)$/;

        let featureTestItem: vscode.TestItem | undefined;

        const lines = content.split('\n');

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
                continue;
            }

            const scenario = scenarioRe.exec(line);
            if (scenario) {
                const [, name] = scenario;
                const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, line.length));
                const isTestCaseOutline = /^\s*Scenario Outline:/.test(line);
                const testItem = controller.createTestItem(`${item.uri}/${name}`, name, item.uri);
                testItem.range = range;
                testItemDataMap.set(testItem, new TestCase(name, isTestCaseOutline));
                featureTestItem?.children.add(testItem);
                continue;
            }
        }

        if (featureTestItem) {
            item.children.replace([featureTestItem]);
        }

        this._didResolve = true;
    }
}
