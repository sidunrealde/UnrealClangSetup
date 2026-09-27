import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { findInstalledEngines, formatEngineVersion, getUbtPath, matchesAssociation } from './engineDiscovery';

/**
 * Finds a .uproject file in the workspace root or one level deep.
 */
export async function findUprojectFile(workspaceRoot: string): Promise<string | undefined> {
    try {
        const files = await fs.promises.readdir(workspaceRoot);
        const uprojectFiles = files.filter(f => f.endsWith('.uproject'));
        if (uprojectFiles.length > 0) {
            return path.join(workspaceRoot, uprojectFiles[0]);
        }

        // Try one level deep (e.g. if the project is in a subdirectory of the workspace)
        for (const file of files) {
            const fullPath = path.join(workspaceRoot, file);
            const stat = await fs.promises.stat(fullPath);
            if (stat.isDirectory()) {
                const subFiles = await fs.promises.readdir(fullPath);
                const subUprojectFiles = subFiles.filter(f => f.endsWith('.uproject'));
                if (subUprojectFiles.length > 0) {
                    return path.join(fullPath, subUprojectFiles[0]);
                }
            }
        }
    } catch (e) {
        console.error('Error listing workspace files for uproject:', e);
    }
    return undefined;
}

/**
 * Searches Source/ directory for *.Target.cs files and determines the Editor target name.
 */
export async function findEditorTarget(projectRoot: string, projectName: string): Promise<string> {
    const sourceDir = path.join(projectRoot, 'Source');
    try {
        if (fs.existsSync(sourceDir)) {
            const files = await fs.promises.readdir(sourceDir);
            const targetFiles = files.filter(f => f.endsWith('.Target.cs'));
            const editorTargetFile = targetFiles.find(f => f.toLowerCase().endsWith('editortarget.cs') || f.toLowerCase().endsWith('editor.target.cs'));
            if (editorTargetFile) {
                // Return target name e.g. "MyProjectEditor" from "MyProjectEditor.Target.cs"
                return editorTargetFile.replace(/\.Target\.cs$/i, '');
            }
            
            // Check subdirectories of Source/ one level deep
            for (const file of files) {
                const subPath = path.join(sourceDir, file);
                const stat = await fs.promises.stat(subPath);
                if (stat.isDirectory()) {
                    const subFiles = await fs.promises.readdir(subPath);
                    const subTargetFiles = subFiles.filter(f => f.endsWith('.Target.cs'));
                    const subEditorTarget = subTargetFiles.find(f => f.toLowerCase().endsWith('editortarget.cs') || f.toLowerCase().endsWith('editor.target.cs'));
                    if (subEditorTarget) {
                        return subEditorTarget.replace(/\.Target\.cs$/i, '');
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error finding editor target:', e);
    }
    // Default fallback
    return `${projectName}Editor`;
}

/**
 * Resolves Engine root path from UBT executable path.
 * Typically UBT path is: [EngineRoot]/Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.exe
 */
export function findEngineRoot(ubtPath: string): string | undefined {
    const normalized = path.normalize(ubtPath).replace(/\\/g, '/');
    const parts = normalized.split('/');
    const engineIdx = parts.lastIndexOf('Engine');
    if (engineIdx !== -1) {
        return path.normalize(parts.slice(0, engineIdx).join('/'));
    }
    // Fallback: 4 levels up
    return path.dirname(path.dirname(path.dirname(path.dirname(ubtPath))));
}

/**
 * Searches .vscode/tasks.json for Unreal Build commands.
 */
async function findUBTFromTasksJson(projectRoot: string): Promise<string | undefined> {
    const tasksJsonPath = path.join(projectRoot, '.vscode', 'tasks.json');
    if (!fs.existsSync(tasksJsonPath)) {
        return undefined;
    }

    try {
        const content = await fs.promises.readFile(tasksJsonPath, 'utf8');
        // Clean JSON from comments (which are common in vscode config files)
        const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
        const tasksObj = JSON.parse(cleanContent);
        if (tasksObj && Array.isArray(tasksObj.tasks)) {
            for (const task of tasksObj.tasks) {
                if (task.command && typeof task.command === 'string') {
                    // Look for UnrealBuildTool or Build.bat or RunUBT.sh/Build.sh
                    const commandLower = task.command.toLowerCase();
                    if (commandLower.includes('unrealbuildtool') || commandLower.includes('build.bat') || commandLower.includes('runubt')) {
                        let candidatePath = task.command;
                        if (candidatePath.endsWith('Build.bat')) {
                            // Map Build.bat to UnrealBuildTool.exe
                            // Engine/Build/BatchFiles/Build.bat -> Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.exe
                            const batchFilesDir = path.dirname(candidatePath);
                            const engineDir = path.dirname(path.dirname(batchFilesDir));
                            candidatePath = path.join(engineDir, 'Binaries', 'DotNET', 'UnrealBuildTool', 'UnrealBuildTool.exe');
                        }
                        if (fs.existsSync(candidatePath)) {
                            return candidatePath;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error parsing tasks.json:', e);
    }
    return undefined;
}

/**
 * Orchestrator to resolve the correct UnrealBuildTool path.
 */
export async function resolveUnrealBuildToolPath(projectRoot: string, uprojectPath: string): Promise<string | undefined> {
    // 1. Check workspace settings config
    const config = vscode.workspace.getConfiguration('unreal-utils');
    const configuredPath = config.get<string>('unrealBuildToolPath');
    if (configuredPath && fs.existsSync(configuredPath)) {
        return configuredPath;
    }

    // 2. Parse tasks.json (very reliable)
    const taskPath = await findUBTFromTasksJson(projectRoot);
    if (taskPath) {
        return taskPath;
    }

    // 3. Resolve using uproject EngineAssociation
    let association = '';
    try {
        const uprojectJson = JSON.parse(await fs.promises.readFile(uprojectPath, 'utf8'));
        if (typeof uprojectJson.EngineAssociation === 'string') {
            association = uprojectJson.EngineAssociation.trim();
        }
    } catch (e) {
        console.error('Error reading EngineAssociation from uproject:', e);
    }

    // If it's an absolute path already
    if (association && path.isAbsolute(association)) {
        const ubtPath = getUbtPath(association);
        if (ubtPath) {
            return ubtPath;
        }
    }

    // Match against engines installed via the Epic Launcher or registered source builds
    const engines = await findInstalledEngines();
    const matched = association ? engines.find(e => matchesAssociation(e, association)) : undefined;
    if (matched) {
        return matched.ubtPath;
    }

    // 4. Fall back to the newest installed engine
    const newest = engines[0];
    if (newest) {
        if (association) {
            vscode.window.showWarningMessage(
                `Project targets Unreal Engine ${association}, which isn't installed. Using UE ${formatEngineVersion(newest)} at ${newest.root}.`
            );
        }
        return newest.ubtPath;
    }

    return undefined;
}

/**
 * Disables Microsoft C/C++ extension IntelliSense in workspace settings.
 */
export async function disableMsIntelliSense(): Promise<void> {
    const config = vscode.workspace.getConfiguration('C_Cpp');
    const engine = config.inspect('intelliSenseEngine');
    
    // Disable it workspace-wide if it's not already disabled
    if (engine?.workspaceValue !== 'disabled') {
        try {
            await config.update('intelliSenseEngine', 'disabled', vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage('Disabled Microsoft C++ IntelliSense Engine to avoid conflicts with clangd.');
        } catch (e) {
            console.error('Failed to update C_Cpp.intelliSenseEngine:', e);
        }
    }
}
