import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const sharedTypesPath = path.resolve(clientRoot, '../shared/types.ts');
const workspaceHelpersPath = path.resolve(clientRoot, 'src/lib/workspace-helpers.ts');
const moduleCache = new Map();

function transpileModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true
    },
    fileName: filePath
  });

  return outputText;
}

function loadTsModule(filePath) {
  if (moduleCache.has(filePath)) {
    return moduleCache.get(filePath);
  }

  const exportsObject = {};
  const moduleObject = { exports: exportsObject };

  const localRequire = (specifier) => {
    if (specifier === '@shared/types') {
      return loadTsModule(sharedTypesPath);
    }

    throw new Error(`Unsupported import in test runner: ${specifier}`);
  };

  const source = transpileModule(filePath);
  const factory = new Function('exports', 'require', 'module', '__filename', '__dirname', source);
  factory(moduleObject.exports, localRequire, moduleObject, filePath, path.dirname(filePath));

  moduleCache.set(filePath, moduleObject.exports);
  return moduleObject.exports;
}

const { groupTasks, usernameOf } = loadTsModule(workspaceHelpersPath);
const { TaskStatus } = loadTsModule(sharedTypesPath);

const grouped = groupTasks([
  {
    id: '1',
    room: 'r',
    title: 'a',
    description: '',
    status: TaskStatus.Todo,
    order: 0,
    createdBy: { id: 'u', username: 'sam' },
    createdAt: '',
    updatedAt: ''
  },
  {
    id: '2',
    room: 'r',
    title: 'b',
    description: '',
    status: TaskStatus.Done,
    order: 1,
    createdBy: { id: 'u', username: 'sam' },
    createdAt: '',
    updatedAt: ''
  }
]);

assert.equal(grouped[TaskStatus.Todo].length, 1);
assert.equal(grouped[TaskStatus.Done].length, 1);
assert.equal(grouped[TaskStatus.Doing].length, 0);
assert.equal(usernameOf('alex'), 'alex');
assert.equal(usernameOf({ username: 'sam' }), 'sam');
assert.equal(usernameOf(undefined), 'Unknown');

console.log('workspace helpers test passed');
