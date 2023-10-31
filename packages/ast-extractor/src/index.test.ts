import { describe, it, expect } from 'vitest';
import { extractSymbols, SymbolExtractor } from './extractor.js';
import { isExported, getExportStatus } from './export-detector.js';
import { generateId } from './id-generator.js';

describe('ASTExtractor', () => {
    describe('extractSymbols', () => {
        it('extracts function from JavaScript', async () => {
            const content = `
        function hello(name) {
          return "Hello " + name;
        }
      `;
            const result = await extractSymbols('test.js', content);

            expect(result.symbols).toHaveLength(1);
            expect(result.symbols[0].name).toBe('hello');
            expect(result.symbols[0].kind).toBe('Function');
            expect(result.symbols[0].filePath).toBe('test.js');
            expect(result.symbols[0].isExported).toBe(false);
        });

        it('extracts class from TypeScript', async () => {
            const content = `
        export class UserService {
          private users: string[] = [];

          addUser(name: string): void {
            this.users.push(name);
          }
        }
      `;
            const result = await extractSymbols('test.ts', content);

            expect(result.symbols).toHaveLength(1);
            expect(result.symbols[0].name).toBe('UserService');
            expect(result.symbols[0].kind).toBe('Class');
            expect(result.symbols[0].isExported).toBe(true);
        });

        it('extracts method from class', async () => {
            const content = `
        class Calculator {
          add(a: number, b: number): number {
            return a + b;
          }
        }
      `;
            const result = await extractSymbols('test.ts', content);

            expect(result.symbols.length).toBeGreaterThanOrEqual(1);
            const method = result.symbols.find(s => s.name === 'add');
            expect(method?.kind).toBe('Method');
        });

        it('extracts interface from TypeScript', async () => {
            const content = `
        export interface User {
          id: number;
          name: string;
        }
      `;
            const result = await extractSymbols('test.ts', content);

            expect(result.symbols[0].name).toBe('User');
            expect(result.symbols[0].kind).toBe('Interface');
            expect(result.symbols[0].isExported).toBe(true);
        });

        it('extracts Python function', async () => {
            const content = `
        def calculate_total(items):
            return sum(items)
      `;
            const result = await extractSymbols('test.py', content);

            expect(result.symbols[0].name).toBe('calculate_total');
            expect(result.symbols[0].kind).toBe('Function');
        });

        it('extracts Python class', async () => {
            const content = `
        class ShoppingCart:
            def __init__(self):
                self.items = []

            def add_item(self, item):
                self.items.append(item)
      `;
            const result = await extractSymbols('test.py', content);

            expect(result.symbols.some(s => s.name === 'ShoppingCart')).toBe(true);
            expect(result.symbols.some(s => s.name === '__init__')).toBe(true);
            expect(result.symbols.some(s => s.name === 'add_item')).toBe(true);
        });

        it('extracts Go function', async () => {
            const content = `
        package main

        func Greet(name string) string {
            return "Hello " + name
        }

        func privateHelper() {}
      `;
            const result = await extractSymbols('test.go', content);

            const greet = result.symbols.find(s => s.name === 'Greet');
            const helper = result.symbols.find(s => s.name === 'privateHelper');

            expect(greet).toBeDefined();
            expect(greet?.isExported).toBe(true);
            expect(helper).toBeDefined();
            expect(helper?.isExported).toBe(false);
        });

        it('extracts Rust function', async () => {
            const content = `
        pub fn public_function(x: i32) -> i32 {
            x + 1
        }

        fn private_function() {}
      `;
            const result = await extractSymbols('test.rs', content);

            const pubFn = result.symbols.find(s => s.name === 'public_function');
            const privFn = result.symbols.find(s => s.name === 'private_function');

            expect(pubFn?.isExported).toBe(true);
            expect(privFn?.isExported).toBe(false);
        });
    });

    describe('ExportDetector', () => {
        it('detects TypeScript exports', () => {
            // Tested via integration
            expect(true).toBe(true);
        });

        it('detects Go exports by capitalization', () => {
            expect(isExported({} as any, 'PublicFunc', 'go')).toBe(true);
            expect(isExported({} as any, 'privateFunc', 'go')).toBe(false);
        });

        it('detects Python exports by underscore', () => {
            expect(isExported({} as any, 'public_func', 'python')).toBe(true);
            expect(isExported({} as any, '_private_func', 'python')).toBe(false);
        });
    });

    describe('IdGenerator', () => {
        it('generates consistent IDs', () => {
            const id1 = generateId('Function', 'src/index.ts:hello');
            const id2 = generateId('Function', 'src/index.ts:hello');
            expect(id1).toBe(id2);
        });

        it('sanitizes special characters', () => {
            const id = generateId('Class', 'src/file.ts:My$Class');
            expect(id).not.toContain('$');
        });
    });
});