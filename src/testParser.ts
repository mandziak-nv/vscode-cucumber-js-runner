import * as vscode from 'vscode';

const testCaseRe = /^\s*Scenario(?: Outline)?:\s*(.+)$/;
const testSuiteRe = /^\s*Feature:\s*(.+)$/;

export const parseTests = (text: string, events: {
	onTestSuite(name: string, range: vscode.Range): void;
	onTestCase(name: string, range: vscode.Range, isOutline: boolean): void;
}) => {
	const lines = text.split('\n');

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		const line = lines[lineNo];
		const testCase = testCaseRe.exec(line);
		if (testCase) {
			const [, name] = testCase;
			const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, line.length));
			const isTestCaseOutline = /^\s*Scenario Outline:/.test(line);
			events.onTestCase(name, range, isTestCaseOutline);
			continue;
		}

		const testSuite = testSuiteRe.exec(line);
		if (testSuite) {
			const [, name] = testSuite;
			const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, line.length));
			events.onTestSuite(name, range);
		}
	}
}