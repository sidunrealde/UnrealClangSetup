import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CLANGD_TEMPLATE } from './clangdTemplate';
import {
    findUprojectFile,
    resolveUnrealBuildToolPath,
    findEditorTarget,
    findEngineRoot,
    disableMsIntelliSense,
    execAsync
} from './utils';

export async function activate(context: vscode.ExtensionContext) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return;
    }

    const workspaceRoot = folders[0].uri.fsPath;
    const uprojectPath = await findUprojectFile(workspaceRoot);
    if (!uprojectPath) {
        return;
    }

    const projectRoot = path.dirname(uprojectPath);
    const projectName = path.basename(uprojectPath, '.uproject');

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('unreal-utils.setupProject', () => setupProject(projectRoot, uprojectPath, projectName)),
        vscode.commands.registerCommand('unreal-utils.generateCompileCommands', () => generateCompileCommandsCommand(projectRoot, uprojectPath, projectName)),
        vscode.commands.registerCommand('unreal-utils.writeClangdConfig', () => writeClangdConfig(projectRoot))
    );

    // Auto-run on startup if enabled
    const config = vscode.workspace.getConfiguration('unreal-utils');
    const autoRun = config.get<boolean>('autoRunOnStartup', true);
    if (autoRun) {
        const clangdPath = path.join(projectRoot, '.clangd');
        const compileCommandsPath = path.join(projectRoot, 'compile_commands.json');

        const needsClangd = !fs.existsSync(clangdPath);
        const needsCompileCommands = !fs.existsSync(compileCommandsPath);

        if (needsClangd || needsCompileCommands) {
            vscode.window.showInformationMessage(
                `Unreal Project detected. Setup clangd configurations for this project?`,
                'Setup Now'
            ).then(selection => {
                if (selection === 'Setup Now') {
                    vscode.commands.executeCommand('unreal-utils.setupProject');
                }
            });
        }
    }
}

async function writeClangdConfig(projectRoot: string): Promise<boolean> {
    const clangdPath = path.join(projectRoot, '.clangd');
    try {
        await fs.promises.writeFile(clangdPath, CLANGD_TEMPLATE, 'utf8');
        vscode.window.showInformationMessage('.clangd configuration file generated successfully at project root.');
        return true;
    } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to write .clangd: ${e.message}`);
        return false;
    }
}

async function setupProject(projectRoot: string, uprojectPath: string, projectName: string) {
    const clangdSuccess = await writeClangdConfig(projectRoot);
    if (clangdSuccess) {
        await disableMsIntelliSense();
        await generateCompileCommandsCommand(projectRoot, uprojectPath, projectName);
    }
}

async function generateCompileCommandsCommand(projectRoot: string, uprojectPath: string, projectName: string) {
    const ubtPath = await resolveUnrealBuildToolPath(projectRoot, uprojectPath);
    if (!ubtPath) {
        const openSettings = 'Open Settings';
        vscode.window.showErrorMessage(
            'Could not locate UnrealBuildTool. Please specify its path in settings.',
            openSettings
        ).then(selection => {
            if (selection === openSettings) {
                vscode.commands.executeCommand('workbench.action.openSettings', 'unreal-utils.unrealBuildToolPath');
            }
        });
        return;
    }

    const config = vscode.workspace.getConfiguration('unreal-utils');
    const targetName = config.get<string>('targetName') || await findEditorTarget(projectRoot, projectName);
    const platform = config.get<string>('buildPlatform') || 'Win64';
    const buildConfig = config.get<string>('buildConfiguration') || 'Development';
    const useNoExec = config.get<boolean>('useNoExecCodeGenActions', true);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating Clang Compilation Database...",
        cancellable: false
    }, async (progress) => {
        progress.report({ message: "Running UnrealBuildTool..." });

        const ubtArgs = [
            '-mode=GenerateClangDatabase',
            `-project="${uprojectPath}"`,
            targetName,
            platform,
            buildConfig
        ];

        if (useNoExec) {
            ubtArgs.push('-NoExecCodeGenActions');
        }

        // Put double quotes around UBT path in case of spaces
        const cmd = `"${ubtPath}" ${ubtArgs.join(' ')}`;

        try {
            console.log(`Executing UBT: ${cmd}`);
            await execAsync(cmd, { cwd: projectRoot });

            progress.report({ message: "Relocating compile_commands.json..." });

            const engineRoot = findEngineRoot(ubtPath);
            let relocated = false;

            if (engineRoot) {
                relocated = await copyCompileCommands(engineRoot, projectRoot);
            }

            if (relocated) {
                vscode.window.showInformationMessage('Successfully generated and set up compile_commands.json at project root!');
            } else {
                // If it wasn't in standard directories, search project root first to see if UBT generated it there directly
                const localCC = path.join(projectRoot, 'compile_commands.json');
                if (fs.existsSync(localCC)) {
                    vscode.window.showInformationMessage('Successfully generated compile_commands.json (already in project root)!');
                } else {
                    vscode.window.showWarningMessage('UBT run completed, but compile_commands.json could not be automatically relocated. Please locate it in the Engine directory and copy it to your project root.');
                }
            }

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to generate clang database: ${error.message || error}`);
        }
    });
}

async function copyCompileCommands(engineRoot: string, projectRoot: string): Promise<boolean> {
    const possiblePaths = [
        path.join(engineRoot, 'compile_commands.json'),
        path.join(engineRoot, 'Engine', 'Source', 'compile_commands.json'),
        path.join(engineRoot, 'Engine', 'Binaries', 'DotNET', 'UnrealBuildTool', 'compile_commands.json'),
        path.join(projectRoot, 'Intermediate', 'Build', 'compile_commands.json'),
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            try {
                const targetPath = path.join(projectRoot, 'compile_commands.json');
                // Ensure target directory exists
                const targetDir = path.dirname(targetPath);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                await fs.promises.copyFile(p, targetPath);
                return true;
            } catch (e) {
                console.error(`Failed to copy compile_commands.json from ${p}:`, e);
            }
        }
    }
    return false;
}

export function deactivate() {}
