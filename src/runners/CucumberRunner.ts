import * as vscode from 'vscode';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as kill from 'tree-kill';
import { getExtensionConfiguration } from '../configuration/configuration';

export class CucumberRunner {
    private static cucumberProcess: ChildProcessWithoutNullStreams | undefined;

    public static log(testRun: vscode.TestRun, message: any): void {
        testRun.appendOutput(message.toString().replaceAll('\n', '\r\n'));
    }

    public static killCucumberProcess(): void {
        if (this.cucumberProcess && this.cucumberProcess.pid) {
            kill(this.cucumberProcess.pid, 'SIGINT');
            this.cucumberProcess = undefined;
        }
    }

    public static async runLine(testRun: vscode.TestRun, path: string, debug?: boolean): Promise<string[]> {
        this.killCucumberProcess();

        return new Promise((resolve) => {
            const cucumberOutput: string[] = [];

            const { env, debugEnv, cliOptions, cwd, cucumberPath } = getExtensionConfiguration();
            const nodeArguments = [cucumberPath, path, ...cliOptions];

            // const nameRegexed = `^${name.replace(/([.+*?^$()[\]{}|\\])/g, '\\$1')}$`;
            // const nodeArguments = [cucumberPath, ...featurePaths, '--name', nameRegexed, ...cliOptions];

            this.log(testRun,
                'Executing command: '
                + (debug && Object.keys(debugEnv).length ? `${Object.keys(debugEnv).map(vr => vr + '=......').join(' ')} ` : '')
                + (Object.keys(env).length ? `${Object.keys(env).map(vr => vr + '=......').join(' ')} ` : '')
                + 'node '
                + nodeArguments.join(' ')
                + '\n\n'
            );

            this.cucumberProcess = spawn('node', nodeArguments, { env: { ...process.env, ...env, ...(debug && debugEnv) }, cwd });

            this.cucumberProcess.stdout.on('data', (chunk: any) => {
                this.log(testRun, chunk);
                cucumberOutput.push(chunk.toString());
            });

            this.cucumberProcess.stderr.on('data', (chunk: any) => {
                this.log(testRun, chunk);
                cucumberOutput.push(chunk.toString());
            });

            this.cucumberProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
                resolve(cucumberOutput);
            });
        });
    }
}
