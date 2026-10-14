import * as fs from 'fs';
import * as path from 'path';

interface CompileCommand {
    command?: string;
    arguments?: string[];
    directory?: string;
}

const SAMPLE_SIZE = 50;

/**
 * UBT's compile commands keep their flags in response files under Intermediate/
 * ("cl.exe @File.cpp.obj.rsp"). If those files are deleted, for example by a clean build,
 * clangd silently loses every include path and define. Returns the first missing
 * response file found in a sample of entries, or undefined if the database looks usable.
 */
export function findMissingResponseFile(compileCommandsPath: string): string | undefined {
    let entries: CompileCommand[];
    try {
        entries = JSON.parse(fs.readFileSync(compileCommandsPath, 'utf8').replace(/^﻿/, ''));
    } catch {
        return undefined;
    }
    if (!Array.isArray(entries) || entries.length === 0) {
        return undefined;
    }

    const step = Math.max(1, Math.floor(entries.length / SAMPLE_SIZE));
    for (let i = 0; i < entries.length; i += step) {
        const entry = entries[i];
        const command = entry.command ?? entry.arguments?.join(' ') ?? '';
        const match = /@"([^"]+\.rsp)"|@(\S+\.rsp)/i.exec(command);
        if (!match) {
            continue;
        }
        const responseFile = path.resolve(entry.directory ?? path.dirname(compileCommandsPath), match[1] ?? match[2]);
        if (!fs.existsSync(responseFile)) {
            return responseFile;
        }
    }
    return undefined;
}
