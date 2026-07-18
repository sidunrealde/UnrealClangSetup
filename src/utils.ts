import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

/**
 * Executes a command and returns the stdout.
 */
export function execAsync(cmd: string, options?: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        cp.exec(cmd, options || {}, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

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
 * Query registry to find UBT from EngineAssociation.
 */
async function findUBTFromRegistry(engineAssociation: string): Promise<string | undefined> {
    if (process.platform !== 'win32') {
        return undefined;
    }

    try {
        // 1. Try Custom builds registry (HKCU\Software\Epic Games\Unreal Engine\Builds)
        const hkcuOutput = await execAsync('reg query "HKCU\\Software\\Epic Games\\Unreal Engine\\Builds"');
        const lines = hkcuOutput.stdout.split('\r\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.includes(engineAssociation)) {
                // Line format typically is: EngineAssociation REG_SZ EnginePath
                const match = trimmed.match(new RegExp(`${engineAssociation}\\s+REG_SZ\\s+(.+)`, 'i'));
                if (match && match[1]) {
                    const enginePath = match[1].trim();
                    const ubtPath = path.join(enginePath, 'Engine', 'Binaries', 'DotNET', 'UnrealBuildTool', 'UnrealBuildTool.exe');
                    if (fs.existsSync(ubtPath)) {
                        return ubtPath;
                    }
                }
            }
        }

        // 2. Try Launcher builds registry (HKLM\SOFTWARE\EpicGames\Unreal Engine)
        const hklmKey = `HKLM\\SOFTWARE\\EpicGames\\Unreal Engine\\${engineAssociation}`;
        const hklmOutput = await execAsync(`reg query "${hklmKey}" /v InstalledDirectory`);
        const hklmLines = hklmOutput.stdout.split('\r\n');
        for (const line of hklmLines) {
            const trimmed = line.trim();
            if (trimmed.includes('InstalledDirectory')) {
                const match = trimmed.match(/InstalledDirectory\s+REG_SZ\s+(.+)/i);
                if (match && match[1]) {
                    const enginePath = match[1].trim();
                    const ubtPath = path.join(enginePath, 'Engine', 'Binaries', 'DotNET', 'UnrealBuildTool', 'UnrealBuildTool.exe');
                    if (fs.existsSync(ubtPath)) {
                        return ubtPath;
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error querying registry:', e);
    }
    return undefined;
}

/**
 * Scans standard paths for Unreal Engine installations and finds UBT.
 */
function findUBTInStandardPaths(): string | undefined {
    const drives = ['C:', 'D:', 'E:', 'F:'];
    const subPaths = [
        'Program Files/Epic Games',
        'Program Files (x86)/Epic Games',
        'Epic Games'
    ];

    for (const drive of drives) {
        for (const subPath of subPaths) {
            const parentDir = path.join(drive, subPath);
            if (fs.existsSync(parentDir)) {
                try {
                    const folders = fs.readdirSync(parentDir);
                    // Match UE_5.x etc.
                    const ueFolders = folders.filter(f => f.startsWith('UE_'));
                    // Sort descending (e.g. UE_5.8 before UE_5.7)
                    ueFolders.sort((a, b) => b.localeCompare(a));
                    for (const folder of ueFolders) {
                        const ubtPath = path.join(parentDir, folder, 'Engine', 'Binaries', 'DotNET', 'UnrealBuildTool', 'UnrealBuildTool.exe');
                        if (fs.existsSync(ubtPath)) {
                            return ubtPath;
                        }
                    }
                } catch (e) {
                    // Ignore read error
                }
            }
        }
    }
    return undefined;
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
    try {
        const uprojectContent = await fs.promises.readFile(uprojectPath, 'utf8');
        const uprojectJson = JSON.parse(uprojectContent);
        const association = uprojectJson.EngineAssociation;
        if (association) {
            // If it's an absolute path already
            if (path.isAbsolute(association) && fs.existsSync(association)) {
                const ubtPath = path.join(association, 'Engine', 'Binaries', 'DotNET', 'UnrealBuildTool', 'UnrealBuildTool.exe');
                if (fs.existsSync(ubtPath)) {
                    return ubtPath;
                }
            }
            const regPath = await findUBTFromRegistry(String(association));
            if (regPath) {
                return regPath;
            }
        }
    } catch (e) {
        console.error('Error resolving via uproject association:', e);
    }

    // 4. Try standard installation folders
    const standardPath = findUBTInStandardPaths();
    if (standardPath) {
        return standardPath;
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
