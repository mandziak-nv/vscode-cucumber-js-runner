import * as vscode from 'vscode';
import { getExtensionConfiguration } from '../configuration/configuration';

export function getTestFilePatterns(): vscode.RelativePattern[] {
    const { featurePaths, cwd } = getExtensionConfiguration();
    return featurePaths.map(path => new vscode.RelativePattern(cwd, path));
}
