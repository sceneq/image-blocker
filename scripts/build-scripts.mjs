import * as esbuild from 'esbuild';
import { copyFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const isDev = process.argv.includes('--dev');
const isChrome = process.argv.includes('--chrome');

const sharedOptions = {
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'iife',
  tsconfig: resolve(root, 'tsconfig.json'),
  define: {
    'import.meta.env.DEV': isDev ? 'true' : 'false',
    'import.meta.env.PROD': isDev ? 'false' : 'true',
  },
};

await Promise.all([
  esbuild.build({
    ...sharedOptions,
    entryPoints: [resolve(root, 'src/entrypoints/background.ts')],
    outfile: resolve(root, 'dist/background.js'),
  }),
  esbuild.build({
    ...sharedOptions,
    entryPoints: [resolve(root, 'src/entrypoints/content.ts')],
    outfile: resolve(root, 'dist/content.js'),
  }),
  // Copy Vite-generated HTML to the dist root. No path fix needed since Vite uses absolute paths.
  copyFile(
    resolve(root, 'dist/src/entrypoints/popup/index.html'),
    resolve(root, 'dist/popup.html'),
  ),
  copyFile(
    resolve(root, 'dist/src/entrypoints/options/index.html'),
    resolve(root, 'dist/options.html'),
  ),
]);

if (isChrome) {
  await copyFile(
    resolve(root, 'public/manifest.chrome.json'),
    resolve(root, 'dist/manifest.json'),
  );
  console.log('Chrome manifest copied.');
}

console.log('Scripts built successfully.');

if (isDev) {
  const sm = resolve(root, 'sample-model');
  const dst = resolve(root, 'dist/dev-fixtures');
  const dstOnnx = resolve(dst, 'komondor-onnx');
  await mkdir(dstOnnx, { recursive: true });
  await Promise.all([
    copyFile(resolve(sm, 'sample-model-komondor.zip'), resolve(dst, 'sample-model-komondor.zip')),
    copyFile(resolve(sm, 'model.fp32.onnx'), resolve(dstOnnx, 'model.fp32.onnx')),
    copyFile(resolve(sm, 'model.fp32.onnx.data'), resolve(dstOnnx, 'model.fp32.onnx.data')),
    copyFile(resolve(sm, 'labels.json'), resolve(dstOnnx, 'labels.json')),
  ]);
  console.log('dev-fixtures copied to dist/');
}
