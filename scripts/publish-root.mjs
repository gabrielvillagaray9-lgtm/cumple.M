import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(projectRoot, 'dist');
const siteAssets = path.join(projectRoot, 'assets');

if (path.dirname(buildDir) !== projectRoot || path.dirname(siteAssets) !== projectRoot) {
  throw new Error('La salida de Pages no coincide con la raíz esperada del proyecto.');
}

const builtEntries = await readdir(buildDir);
if (!builtEntries.includes('index.html') || !builtEntries.includes('assets') || !builtEntries.includes('imágenes')) {
  throw new Error('No se encontró una compilación completa para publicar en la raíz.');
}

const assetInfo = await stat(path.join(buildDir, 'assets'));
if (!assetInfo.isDirectory()) throw new Error('La carpeta de recursos compilados no es válida.');

await rm(siteAssets, { recursive: true, force: true });
await mkdir(siteAssets, { recursive: true });
await cp(path.join(buildDir, 'assets'), siteAssets, { recursive: true });
await cp(path.join(buildDir, 'index.html'), path.join(projectRoot, 'index.html'));
await cp(path.join(buildDir, 'imágenes'), path.join(projectRoot, 'imágenes'), { recursive: true, force: true });

console.log('GitHub Pages: index.html y assets/ se actualizaron en la raíz.');
