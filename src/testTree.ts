import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { parseTests } from './testParser';

let generationCounter = 0;

export class TestFile {
	public didResolve = false;
	private textDecoder;

	constructor(textDecoder: TextDecoder) {
		this.textDecoder = textDecoder;
	}

	async getContentFromFilesystem(uri: vscode.Uri) {
		try {
			return this.textDecoder.decode(await vscode.workspace.fs.readFile(uri));
		} catch (e) {
			console.warn(`Error providing tests for ${uri.fsPath}`, e);
			return '';
		}
	};

	public async updateFromDisk(controller: vscode.TestController, item: vscode.TestItem) {
		try {
			const content = await this.getContentFromFilesystem(item.uri!);
			item.error = undefined;
			this.updateFromContents(controller, content, item);
		} catch (e) {
			item.error = (e as Error).stack;
		}
	}

	public updateFromContents(controller: vscode.TestController, content: string, item: vscode.TestItem) {
		const ancestors = [{ item, children: [] as vscode.TestItem[] }];
		const thisGeneration = generationCounter++;
		this.didResolve = true;

		const ascend = (depth: number) => {
			while (ancestors.length > depth) {
				const finished = ancestors.pop()!;
				finished.item.children.replace(finished.children);
			}
		};

		parseTests(content, {
			onTestSuite: (name, range) => {
				const parent = ancestors[ancestors.length - 1];
				const id = `${item.uri}/${name}`;

				const testSuite = controller.createTestItem(id, name, item.uri);
				testSuite.range = range;
				testData.set(testSuite, new TestSuite(thisGeneration));
				parent.children.push(testSuite);
				ancestors.push({ item: testSuite, children: [] });
			},
			onTestCase: (name, range) => {
				const parent = ancestors[ancestors.length - 1];
				const data = new TestCase(name, thisGeneration);
				const id = `${item.uri}/${data.getLabel()}`;

				const testCase = controller.createTestItem(id, data.getLabel(), item.uri);
				testData.set(testCase, data);
				testCase.range = range;
				parent.children.push(testCase);
			},
		});

		ascend(0);
	}
}

export class TestSuite {
	constructor(public generation: number) { }
}

export class TestCase {
	constructor(private readonly _name: string, public generation: number) { }

	get name() {
		return this._name;
	}

	getLabel() {
		return this.name;
	}
}

export type TestItemData = TestFile | TestSuite | TestCase;

export const testData = new WeakMap<vscode.TestItem, TestItemData>();