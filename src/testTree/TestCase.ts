import { Position } from 'vscode';

export default class TestCase {
    constructor(
        public readonly name: string,
        public readonly isOutline: boolean,
        public readonly startLine: Position
    ) {}
}
