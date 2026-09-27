import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export type CompilerChoice = 'auto' | 'Clang' | 'VisualStudio';

export interface GenerateOptions {
    ubtPath: string;
    uprojectPath: string;
    target: string;
    platform: string;
    configuration: string;
    noExecCodeGenActions: boolean;
    compiler: CompilerChoice;
    /** Directory UBT should write compile_commands.json to (requires -OutputDir support). */
    outputDir?: string;
    cwd: string;
    log: (text: string) => void;
}

export interface GenerateResult {
    success: boolean;
    exitCode: number;
    output: string;
    /** True when auto mode switched to MSVC because Clang isn't installed. */
    usedMsvcFallback: boolean;
}

// UE 5.x's GenerateClangDatabase mode defaults to the Clang toolchain and fails without it
const CLANG_MISSING = /Clang(?: x64)? must be installed|Unable to find (?:a )?(?:valid |compatible )?(?:installation of )?Clang/i;
// Unreal Header Tool occasionally crashes while parsing in parallel; a second run usually succeeds
const UHT_CRASH = /Internal Compiler Error|AccessViolationException/;
const MAX_KEPT_OUTPUT = 200_000;

/** True if this engine's UBT accepts -OutputDir= for GenerateClangDatabase (checked in the shipped UBT source). */
export function supportsOutputDir(engineRoot: string): boolean {
    const modeSource = path.join(engineRoot, 'Engine', 'Source', 'Programs', 'UnrealBuildTool', 'Modes', 'GenerateClangDatabase.cs');
    try {
        return fs.readFileSync(modeSource, 'utf8').includes('-OutputDir=');
    } catch {
        return false;
    }
}

/** Most useful line to show when UBT fails, e.g. "Clang x64 must be installed in order to build this target." */
export function summarizeFailure(output: string): string | undefined {
    const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return (
        lines.find(l => CLANG_MISSING.test(l)) ??
        lines.find(l => /\berror\b|must be installed|exception/i.test(l) && !/^Result:/i.test(l))
    );
}

/** Runs a process and streams its output. .bat/.cmd files (e.g. Build.bat) need a shell on Windows. */
export function runProcess(command: string, args: string[], cwd: string, onOutput: (text: string) => void): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve, reject) => {
        const quote = (s: string) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
        const child = /\.(bat|cmd)$/i.test(command)
            ? cp.spawn(quote(command), args.map(quote), { cwd, shell: true, windowsHide: true })
            : cp.spawn(command, args, { cwd, windowsHide: true });
        let output = '';
        const collect = (data: Buffer) => {
            const text = data.toString();
            output = (output + text).slice(-MAX_KEPT_OUTPUT);
            onOutput(text);
        };
        child.stdout.on('data', collect);
        child.stderr.on('data', collect);
        child.on('error', reject);
        child.on('close', code => resolve({ exitCode: code ?? -1, output }));
    });
}

/**
 * Runs UBT -mode=GenerateClangDatabase. In auto mode, falls back to the MSVC toolchain when
 * Clang isn't installed, and retries once if Unreal Header Tool crashes.
 */
export async function generateClangDatabase(options: GenerateOptions): Promise<GenerateResult> {
    const baseArgs = [
        '-mode=GenerateClangDatabase',
        `-project=${options.uprojectPath}`,
        options.target,
        options.platform,
        options.configuration,
        ...(options.noExecCodeGenActions ? ['-NoExecCodeGenActions'] : []),
        ...(options.outputDir ? [`-OutputDir=${options.outputDir}`] : []),
    ];
    let compilerArgs = options.compiler === 'auto' ? [] : [`-Compiler=${options.compiler}`];
    let usedMsvcFallback = false;
    let retriedUht = false;

    for (;;) {
        const args = [...baseArgs, ...compilerArgs];
        options.log(`> "${options.ubtPath}" ${args.join(' ')}\n`);
        const { exitCode, output } = await runProcess(options.ubtPath, args, options.cwd, options.log);
        if (exitCode === 0) {
            return { success: true, exitCode, output, usedMsvcFallback };
        }
        if (options.compiler === 'auto' && !usedMsvcFallback && CLANG_MISSING.test(output)) {
            usedMsvcFallback = true;
            compilerArgs = ['-Compiler=VisualStudio'];
            options.log('\nClang is not installed; retrying with the Visual Studio (MSVC) toolchain.\n\n');
            continue;
        }
        if (!retriedUht && UHT_CRASH.test(output)) {
            retriedUht = true;
            options.log('\nUnreal Header Tool crashed; retrying once.\n\n');
            continue;
        }
        return { success: false, exitCode, output, usedMsvcFallback };
    }
}
