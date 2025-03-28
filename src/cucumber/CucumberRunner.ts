import * as vscode from 'vscode';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { getExtensionConfiguration } from '../configuration/getExtensionConfiguration';

export class CucumberRunner {
    private static cucumberProcess: ChildProcessWithoutNullStreams | undefined;

    public static async runTest(testRun: vscode.TestRun, scenarioName: string, debug?: boolean): Promise<string[]> {
        this.killCucumberProcess();

        return new Promise((resolve) => {
            const cucumberOutput: string[] = [];

            this.cucumberProcess = this.spawnCucumberProcess(testRun, scenarioName, debug);

            this.cucumberProcess.stdout.on('data', (chunk: any) => {
                this.log(testRun, chunk);
                cucumberOutput.push(chunk.toString());
            });

            this.cucumberProcess.stderr.on('data', (chunk: any) => {
                this.log(testRun, chunk);
            });

            this.cucumberProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
                resolve(cucumberOutput);
            });
        });
    }

    private static spawnCucumberProcess(testRun: vscode.TestRun, scenarioName: string, debug?: boolean): ChildProcessWithoutNullStreams {
        const cwd = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.path;
        let scenarioNameRegexed = `^${scenarioName.replace(/([.+*?^$()[\]{}|\\])/g, '\\$1')}$`;
        scenarioNameRegexed = scenarioNameRegexed.replace(/<[^>]*>/g, ".*"); // match any example parameter
        const { featurePaths, env, cliOptions, cucumberPath } = getExtensionConfiguration();
        const nodeArguments = [cucumberPath, ...featurePaths, '--name', scenarioNameRegexed, ...cliOptions];

        this.log(testRun,
            'Executing command: '
            // + (debug ? 'DEBUG=cucumber ' : '')
            + (Object.keys(env).length ? `${Object.keys(env).map(vr => vr + '=......').join(' ')} ` : '')
            + 'node '
            + [cucumberPath, ...featurePaths, '--name', `"${scenarioNameRegexed}"`, ...cliOptions].join(' ')
            + '\n\n'
        );

        return spawn(
            'node', nodeArguments,
            {
                cwd: cwd,
                env: {
                    ...process.env, ...env,
                    // ...(debug && { 'DEBUG': 'cucumber' }),
                },
            }
        );
    }

    public static killCucumberProcess(signal?: NodeJS.Signals | number): boolean {
        if (this.cucumberProcess && !this.cucumberProcess.killed) {
            return this.cucumberProcess.kill(signal);
        }
        return true;
    }

    public static log(testRun: vscode.TestRun, message: any): void {
        testRun.appendOutput(message.toString().replaceAll('\n', '\r\n'));
    }
}
