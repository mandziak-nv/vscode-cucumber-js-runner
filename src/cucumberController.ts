import * as vscode from "vscode";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { getExtensionConfiguration } from "./extensionConfiguration";

export class CucumberRunner {
    cucumberProcess: ChildProcessWithoutNullStreams | undefined;
    currentTestRun: vscode.TestRun | null | undefined;

    private log(message: any) {
        this.currentTestRun?.appendOutput(message.toString().replaceAll('\n', '\r\n'));
    }

    private runCucumberProcess(scenarioName: string, debug?: boolean): void {
        const cwd = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.path;
        const cucumberPath = './node_modules/.bin/cucumber-js';
        const scenarioNameRegexed = `^${scenarioName.replace(/([.+*?^$()[\]{}|\\])/g, '\\$1')}$`;
        const { featurePaths, env, cliOptions } = getExtensionConfiguration();
        const nodeArguments = [cucumberPath, ...featurePaths, '--name', scenarioNameRegexed, ...cliOptions];

        this.killCucumberProcess();

        this.log(
            'Executing command:\n'
            // + (debug ? 'DEBUG=cucumber ' : '')
            + (Object.keys(env).length ? `${Object.keys(env).map(vr => vr + '=......').join(' ')} ` : '')
            + 'node '
            + [cucumberPath, ...featurePaths, '--name', `"${scenarioNameRegexed}"`, ...cliOptions].join(' ')
            + '\n\n'
        );

        this.cucumberProcess = spawn(
            'node', nodeArguments,
            {
                cwd: cwd,
                env: {
                    ...process.env, ...env,
                    // ...(debug && { 'DEBUG': 'cucumber' })
                },
            }
        );
    }

    public killCucumberProcess(signal?: NodeJS.Signals | number): boolean {
        if (this.cucumberProcess && !this.cucumberProcess.killed) {
            return this.cucumberProcess.kill(signal);
        }
        return true;
    }

    public async runTest(scenarioName: string, testRun: vscode.TestRun, debug?: boolean): Promise<string[]> {
        this.currentTestRun = testRun;
        return new Promise((resolve) => {
            const cucumberOutput: string[] = [];

            this.runCucumberProcess(scenarioName, debug);

            this.cucumberProcess!.stdout.on('data', (chunk: any) => {
                this.log(chunk);
                cucumberOutput.push(chunk.toString());
            });

            this.cucumberProcess!.stderr.on('data', (chunk: any) => {
                this.log(chunk);
            });

            this.cucumberProcess!.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
                this.currentTestRun = null;
                resolve(cucumberOutput);
            });
        });
    }
}