import * as vscode from 'vscode';
import TestFile from '../models/TestFile';
import TestSuite from '../models/TestSuite';
import TestCase from '../models/TestCase';

import { TEST_ITEM_DATA_MAP } from '../state/global';

const textDecoder = new TextDecoder('utf-8');

const FEATURE_LINE_RE = /^\s*(?:Feature|Business Need|Ability):\s*(.+?)\s*$/;
const SCENARIO_LINE_RE = /^\s*(?:Example|Scenario|Scenario Outline|Scenario Template):\s*(.+?)\s*$/;
const SCENARIO_OUTLINE_LINE_RE = /^\s*(?:Scenario Outline|Scenario Template):\s*(.+?)\s*$/;
const STEP_LINE_RE = /^\s*(?:Given|When|Then|And|But|\*):\s*(.+?)\s*$/;
const EXAMPLES_LINE_RE = /^\s*(?:Examples|Scenarios):\s*(.*?)\s*$/;
const TABLE_ROW_LINE_RE = /^\s*\|(?:(.+)\|)*\s*$/;

export async function resolveTestItemChildren(controller: vscode.TestController, item: vscode.TestItem): Promise<void> {
    try {
        const content = textDecoder.decode(await vscode.workspace.fs.readFile(item.uri!));
        item.error = undefined;

        let currentFeature: vscode.TestItem | null = null;
        let currentScenario: vscode.TestItem | null = null;
        let isExamplesSection: boolean = false;
        let examplesSectionHeaders: string[] | null = null;

        const lines = content.split('\n');

        for (let lineNo = 0; lineNo < lines.length; lineNo++) {
            const line = lines[lineNo];

            if (!currentFeature) {
                const featureLine = FEATURE_LINE_RE.exec(line);
                if (featureLine) {
                    const [, name] = featureLine;
                    const featureItem = controller.createTestItem(`${item.uri?.toString()}/${name}`, name, item.uri);
                    featureItem.range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, line.length));
                    TEST_ITEM_DATA_MAP.set(featureItem, new TestSuite());
                    currentFeature = featureItem;
                    continue;
                }
            } else {
                const scenarioLine = SCENARIO_LINE_RE.exec(line);
                if (scenarioLine) {
                    const [, name] = scenarioLine;
                    const scenarioItem = controller.createTestItem(`${item.uri?.toString()}/${name}`, name, item.uri);
                    scenarioItem.range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, line.length));
                    const isScenarioOutline = SCENARIO_OUTLINE_LINE_RE.test(line);
                    TEST_ITEM_DATA_MAP.set(scenarioItem, isScenarioOutline ? new TestSuite() : new TestCase(name, `${item.uri?.fsPath}:${lineNo + 1}`));
                    currentFeature.children.add(scenarioItem);
                    currentScenario = scenarioItem;
                    isExamplesSection = false;
                    continue;
                }

                const examplesLine = EXAMPLES_LINE_RE.exec(line);
                if (examplesLine) {
                    isExamplesSection = true;
                    examplesSectionHeaders = null;
                    continue;
                }

                if (isExamplesSection) {
                    const tableRowLine = TABLE_ROW_LINE_RE.exec(line);
                    if (tableRowLine) {
                        const [, tableRowLineData] = tableRowLine;
                        const tableRowValues = tableRowLineData.split("|").map((value) => value.trim());
                        if (!examplesSectionHeaders) {
                            examplesSectionHeaders = tableRowValues;
                        } else {
                            if (examplesSectionHeaders.length !== tableRowValues.length) {
                                continue;
                            }
                            let name = `| ${examplesSectionHeaders.map((header, index) => header + ' = ' + tableRowValues[index]).join(' | ')} |`;
                            const tableRowItem = controller.createTestItem(`${item.uri?.toString()}/${currentScenario?.label}/${name}`, name, item.uri);
                            tableRowItem.range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, line.length));
                            TEST_ITEM_DATA_MAP.set(tableRowItem, new TestCase(name, `${item.uri?.fsPath}:${lineNo + 1}`));
                            currentScenario?.children.add(tableRowItem);
                        }
                        continue;
                    }
                }
            }
        }

        item.children.replace(currentFeature ? [currentFeature] : []);

        const itemData = TEST_ITEM_DATA_MAP.get(item);
        if (itemData instanceof TestFile) {
            itemData.setResolved();
        }
    } catch (e) {
        item.error = (e as Error).stack;
    }
}
