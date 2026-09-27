import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

export interface EngineInstall {
    /** Identifier as used by .uproject EngineAssociation: "5.4" for launcher builds, "{GUID}" for source builds. */
    id: string;
    root: string;
    ubtPath: string;
    version: number[];
    source: 'registry' | 'source-build' | 'launcher-manifest';
}

type EngineCandidate = Pick<EngineInstall, 'id' | 'root' | 'source'>;

interface RegistryValue {
    key: string;
    name: string;
    value: string;
}

/**
 * Returns the UnrealBuildTool executable inside an engine root (UE5 layout first, then UE4), if it exists.
 */
export function getUbtPath(engineRoot: string): string | undefined {
    const candidates = [
        path.join(engineRoot, 'Engine', 'Binaries', 'DotNET', 'UnrealBuildTool', 'UnrealBuildTool.exe'),
        path.join(engineRoot, 'Engine', 'Binaries', 'DotNET', 'UnrealBuildTool.exe'),
    ];
    return candidates.find(p => fs.existsSync(p));
}

/**
 * Runs `reg query <key> /s` and returns its string values.
 * Resolves to an empty list if the key doesn't exist, so one missing key never hides the others.
 */
function queryRegistry(key: string): Promise<RegistryValue[]> {
    return new Promise(resolve => {
        cp.execFile('reg', ['query', key, '/s'], { windowsHide: true }, (error, stdout) => {
            if (error) {
                resolve([]);
                return;
            }
            const values: RegistryValue[] = [];
            let currentKey = key;
            for (const line of stdout.split(/\r?\n/)) {
                if (line.startsWith('HKEY_')) {
                    currentKey = line.trim();
                    continue;
                }
                // Line format: "    <Name>    REG_SZ    <Value>"
                const match = line.match(/^\s+(.+?)\s+REG_SZ\s+(.*)$/);
                if (match) {
                    values.push({ key: currentKey, name: match[1], value: match[2].trim() });
                }
            }
            resolve(values);
        });
    });
}

/**
 * Launcher builds: <key>\<version> with an InstalledDirectory value.
 */
async function readLauncherRegistry(key: string): Promise<EngineCandidate[]> {
    const values = await queryRegistry(key);
    return values
        .filter(v => v.name.toLowerCase() === 'installeddirectory')
        .map(v => ({ id: v.key.split('\\').pop() || '', root: v.value, source: 'registry' as const }));
}

/**
 * Source builds registered by UnrealVersionSelector: one value per engine, named by its GUID.
 */
async function readSourceBuildRegistry(): Promise<EngineCandidate[]> {
    const values = await queryRegistry('HKCU\\Software\\Epic Games\\Unreal Engine\\Builds');
    return values.map(v => ({ id: v.name, root: v.value, source: 'source-build' as const }));
}

/**
 * Epic Games Launcher install list. More reliable than the registry, which keeps entries
 * for uninstalled engines and can miss newer installs.
 */
async function readLauncherManifest(): Promise<EngineCandidate[]> {
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    const manifestPath = path.join(programData, 'Epic', 'UnrealEngineLauncher', 'LauncherInstalled.dat');
    try {
        const content = await fs.promises.readFile(manifestPath, 'utf8');
        const list = JSON.parse(content.replace(/^\uFEFF/, '')).InstallationList;
        if (!Array.isArray(list)) {
            return [];
        }
        const candidates: EngineCandidate[] = [];
        for (const item of list) {
            const match = typeof item?.AppName === 'string' ? item.AppName.match(/^UE_(\d+(?:\.\d+)*)$/) : null;
            if (match && typeof item.InstallLocation === 'string') {
                candidates.push({ id: match[1], root: item.InstallLocation, source: 'launcher-manifest' });
            }
        }
        return candidates;
    } catch {
        return [];
    }
}

/**
 * Reads the engine version from Engine/Build/Build.version, falling back to parsing the identifier.
 */
function readEngineVersion(engineRoot: string, id: string): number[] {
    try {
        const content = fs.readFileSync(path.join(engineRoot, 'Engine', 'Build', 'Build.version'), 'utf8');
        const buildVersion = JSON.parse(content.replace(/^\uFEFF/, ''));
        if (typeof buildVersion.MajorVersion === 'number') {
            return [buildVersion.MajorVersion, buildVersion.MinorVersion ?? 0, buildVersion.PatchVersion ?? 0];
        }
    } catch {
        // Fall through to the identifier
    }
    if (/^\d+(\.\d+)*$/.test(id)) {
        return id.split('.').map(Number);
    }
    return [0];
}

function compareVersions(a: number[], b: number[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) {
            return diff;
        }
    }
    return 0;
}

/**
 * Finds all installed Unreal Engine versions that have an UnrealBuildTool, newest first.
 */
export async function findInstalledEngines(): Promise<EngineInstall[]> {
    if (process.platform !== 'win32') {
        return [];
    }

    // Launcher manifest first: it is the most accurate source when an engine appears in several.
    const sources = await Promise.all([
        readLauncherManifest(),
        readLauncherRegistry('HKLM\\SOFTWARE\\EpicGames\\Unreal Engine'),
        readLauncherRegistry('HKLM\\SOFTWARE\\WOW6432Node\\EpicGames\\Unreal Engine'),
        readSourceBuildRegistry(),
    ]);

    const engines: EngineInstall[] = [];
    const seenRoots = new Set<string>();
    for (const candidate of sources.flat()) {
        if (!candidate.id || !candidate.root) {
            continue;
        }
        const root = path.resolve(candidate.root);
        const rootKey = root.toLowerCase();
        if (seenRoots.has(rootKey)) {
            continue;
        }
        // Skip stale entries for engines that have since been uninstalled
        const ubtPath = getUbtPath(root);
        if (!ubtPath) {
            continue;
        }
        seenRoots.add(rootKey);
        engines.push({ ...candidate, root, ubtPath, version: readEngineVersion(root, candidate.id) });
    }

    engines.sort((a, b) => compareVersions(b.version, a.version));
    return engines;
}

/**
 * True if the engine is the one named by a .uproject EngineAssociation ("5.4" or "{GUID}").
 */
export function matchesAssociation(engine: EngineInstall, association: string): boolean {
    const normalize = (s: string) => s.trim().replace(/^\{|\}$/g, '').toLowerCase();
    return normalize(engine.id) === normalize(association);
}

/**
 * Human-readable engine version, e.g. "5.8", or the identifier if the version is unknown.
 */
export function formatEngineVersion(engine: EngineInstall): string {
    return engine.version[0] ? engine.version.slice(0, 2).join('.') : engine.id;
}
