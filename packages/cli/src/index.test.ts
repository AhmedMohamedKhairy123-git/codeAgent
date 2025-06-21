import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createProgram } from './cli.js';

describe('CLI', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = path.join(os.tmpdir(), `codeagent-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });

    it('creates program with commands', () => {
        const program = createProgram();
        expect(program.commands.length).toBeGreaterThan(0);

        const commandNames = program.commands.map(c => c.name());
        expect(commandNames).toContain('analyze');
        expect(commandNames).toContain('status');
        expect(commandNames).toContain('list');
        expect(commandNames).toContain('clean');
        expect(commandNames).toContain('serve');
        expect(commandNames).toContain('mcp');
    });

    it('parses analyze command', async () => {
        // This is a simple parse test - actual analysis is tested elsewhere
        const program = createProgram();
        // Just verify command exists
        const analyzeCmd = program.commands.find(c => c.name() === 'analyze');
        expect(analyzeCmd).toBeDefined();
    });

    it('parses status command', () => {
        const program = createProgram();
        const statusCmd = program.commands.find(c => c.name() === 'status');
        expect(statusCmd).toBeDefined();
    });
});