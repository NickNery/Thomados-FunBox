import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const binary = resolve(root, 'vendor', 'yt-dlp', 'yt-dlp.exe');

if (!existsSync(binary) || !statSync(binary).isFile()) {
  throw new Error(`yt-dlp não encontrado: ${binary}`);
}

const result = spawnSync(binary, ['--version'], {
  encoding: 'utf8',
  windowsHide: true
});

if (result.error || result.status !== 0) {
  throw result.error || new Error(result.stderr.trim() || `yt-dlp terminou com código ${result.status}.`);
}

const version = result.stdout.trim();

if (!/^\d{4}\.\d{2}\.\d{2}/.test(version)) {
  throw new Error(`Versão inesperada do yt-dlp: ${version}`);
}

console.log(`yt-dlp ${version} validado.`);
