import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { rollup } from 'rollup';
import ts from 'typescript';
import { compile } from 'tailwindcss';

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const distRoot = path.join(clientRoot, 'dist');
const assetsRoot = path.join(distRoot, 'assets');
const sharedRoot = path.resolve(clientRoot, '../shared');
const axiosPackageRoot = path.dirname(require.resolve('axios/package.json'));
const zodPackageRoot = path.dirname(require.resolve('zod/package.json'));
const zustandPackageRoot = path.dirname(require.resolve('zustand/package.json'));
const reactPackageRoot = path.dirname(require.resolve('react/package.json'));
const reactDomPackageRoot = path.dirname(require.resolve('react-dom/package.json'));
const socketIoClientPackageRoot = path.dirname(require.resolve('socket.io-client/package.json'));
const vendorScripts = [
  {
    source: path.join(axiosPackageRoot, 'dist/axios.min.js'),
    target: path.join(assetsRoot, 'vendor/axios.min.js')
  },
  {
    source: path.join(reactPackageRoot, 'umd/react.production.min.js'),
    target: path.join(assetsRoot, 'vendor/react.production.min.js')
  },
  {
    source: path.join(reactDomPackageRoot, 'umd/react-dom.production.min.js'),
    target: path.join(assetsRoot, 'vendor/react-dom.production.min.js')
  },
  {
    source: path.join(socketIoClientPackageRoot, 'dist/socket.io.min.js'),
    target: path.join(assetsRoot, 'vendor/socket.io.min.js')
  }
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function writeText(filePath, contents) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, 'utf8');
}

async function walkFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function extractCandidates(source) {
  const matches = source.match(/["'`][^"'`]*["'`]/gs) ?? [];
  const candidates = new Set();

  for (const match of matches) {
    const value = match.slice(1, -1);
    for (const token of value.split(/\s+/)) {
      const candidate = token.trim();
      if (candidate) {
        candidates.add(candidate);
      }
    }
  }

  return candidates;
}

async function collectTailwindCandidates() {
  const sources = [path.join(clientRoot, 'index.html'), ...(await walkFiles(path.join(clientRoot, 'src')))];
  const candidates = new Set();

  for (const filePath of sources) {
    const contents = await readText(filePath);
    for (const candidate of extractCandidates(contents)) {
      candidates.add(candidate);
    }
  }

  return [...candidates];
}

async function compileTailwindCss() {
  const inputPath = path.join(clientRoot, 'src/index.css');
  const cssSource = await readText(inputPath);
  const tailwindCssPath = require.resolve('tailwindcss/index.css');
  const result = await compile(cssSource, {
    from: inputPath,
    base: clientRoot,
    loadStylesheet: async (id, base) => {
      const resolved = id === 'tailwindcss' ? tailwindCssPath : path.resolve(base, id);
      return {
        path: resolved,
        base: path.dirname(resolved),
        content: await readText(resolved)
      };
    }
  });

  const candidates = await collectTailwindCandidates();
  const output = result.build(candidates);
  await writeText(path.join(assetsRoot, 'styles.css'), output);
}

function resolveWithExtensions(candidate) {
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  for (const extension of extensions) {
    const filePath = `${candidate}${extension}`;
    if (fsSync.existsSync(filePath) && fsSync.statSync(filePath).isFile()) {
      return filePath;
    }
  }

  for (const extension of extensions) {
    const indexPath = path.join(candidate, `index${extension}`);
    if (fsSync.existsSync(indexPath) && fsSync.statSync(indexPath).isFile()) {
      return indexPath;
    }
  }

  return null;
}

function createRollupPlugin() {
  return {
    name: 'devcollab-resolver',
    async resolveId(source, importer) {
      if (source.startsWith('\0')) {
        return null;
      }

      if (source === 'react') {
        return '\0virtual-react';
      }

      if (source === 'react-dom/client') {
        return '\0virtual-react-dom-client';
      }

      if (source === 'react/jsx-runtime') {
        return '\0virtual-react-jsx-runtime';
      }

      if (source === 'socket.io-client') {
        return '\0virtual-socket-io-client';
      }

      if (source === 'axios') {
        return '\0virtual-axios';
      }

      if (source === 'zod') {
        return path.join(zodPackageRoot, 'index.js');
      }

      if (source === 'zustand') {
        return path.join(zustandPackageRoot, 'esm/react.mjs');
      }

      if (source === 'zustand/vanilla') {
        return path.join(zustandPackageRoot, 'esm/vanilla.mjs');
      }

      if (source.startsWith('@/')) {
        return resolveWithExtensions(path.join(clientRoot, 'src', source.slice(2)));
      }

      if (source.startsWith('@shared/')) {
        return resolveWithExtensions(path.join(sharedRoot, source.slice('@shared/'.length)));
      }

      if (source.startsWith('.') || path.isAbsolute(source)) {
        const baseDir = importer ? path.dirname(importer) : clientRoot;
        return resolveWithExtensions(path.resolve(baseDir, source));
      }

      try {
        return require.resolve(source, { paths: [importer ? path.dirname(importer) : clientRoot] });
      } catch {
        return null;
      }
    },
    async load(id) {
      if (id === '\0virtual-axios') {
        return [
          'const axios = globalThis.axios;',
          'export default axios;',
          'export const AxiosError = axios.AxiosError;',
          'export const isAxiosError = axios.isAxiosError;',
          'export const create = axios.create;'
        ].join('\n');
      }

      if (id === '\0virtual-react') {
        return [
          'const React = globalThis.React;',
          'export const StrictMode = React.StrictMode;',
          'export const Suspense = React.Suspense;',
          'export const lazy = React.lazy;',
          'export const useCallback = React.useCallback;',
          'export const useEffect = React.useEffect;',
          'export const useMemo = React.useMemo;',
          'export const useState = React.useState;',
          'export const useRef = React.useRef;',
          'export const useSyncExternalStore = React.useSyncExternalStore;',
          'export const useDebugValue = React.useDebugValue;',
          'export default React;'
        ].join('\n');
      }

      if (id === '\0virtual-react-dom-client') {
        return [
          'const ReactDOM = globalThis.ReactDOM;',
          'export const createRoot = ReactDOM.createRoot;',
          'export default { createRoot };'
        ].join('\n');
      }

      if (id === '\0virtual-react-jsx-runtime') {
        return [
          'const React = globalThis.React;',
          'export const Fragment = React.Fragment;',
          'export const jsx = (type, props, key) => React.createElement(type, { ...props, key });',
          'export const jsxs = jsx;',
          'export default { jsx, jsxs, Fragment };'
        ].join('\n');
      }

      if (id === '\0virtual-socket-io-client') {
        return [
          'const io = globalThis.io;',
          'export { io };',
          'export default io;'
        ].join('\n');
      }

      if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(id)) {
        return readText(id);
      }

      return null;
    },
    transform(code, id) {
      if (!/\.(ts|tsx)$/.test(id)) {
        return null;
      }

      const result = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
          sourceMap: false,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true
        },
        fileName: id
      });

      return {
        code: result.outputText,
        map: null
      };
    }
  };
}

async function bundleApp() {
  const bundle = await rollup({
    input: path.join(clientRoot, 'src/main.tsx'),
    plugins: [createRollupPlugin()]
  });

  await bundle.write({
    dir: assetsRoot,
    format: 'esm',
    entryFileNames: 'app.js',
    chunkFileNames: 'chunks/[name]-[hash].js',
    sourcemap: false
  });

  await bundle.close();
}

async function writeHtml() {
  const source = await readText(path.join(clientRoot, 'index.html'));
  const html = source
    .replace(
      '</head>',
      [
        '    <link rel="stylesheet" href="/assets/styles.css" />',
        '    <script src="/assets/vendor/axios.min.js"></script>',
        '    <script src="/assets/vendor/react.production.min.js"></script>',
        '    <script src="/assets/vendor/react-dom.production.min.js"></script>',
        '    <script src="/assets/vendor/socket.io.min.js"></script>',
        '  </head>'
      ].join('\n')
    )
    .replace('<script type="module" src="/src/main.tsx"></script>', '    <script type="module" src="/assets/app.js"></script>');

  await writeText(path.join(distRoot, 'index.html'), html);
}

async function copyVendorScripts() {
  await Promise.all(
    vendorScripts.map(async ({ source, target }) => {
      await ensureDir(path.dirname(target));
      await fs.copyFile(source, target);
    })
  );
}

export async function buildClient() {
  await ensureDir(assetsRoot);
  await Promise.all([compileTailwindCss(), copyVendorScripts(), bundleApp()]);
  await writeHtml();
}
