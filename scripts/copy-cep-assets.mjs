import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

await mkdir(dist, { recursive: true });

for (const directory of ['CSXS', 'host', 'mogrt']) {
  const source = resolve(root, directory);
  const target = resolve(dist, directory);

  if (existsSync(source)) {
    await cp(source, target, { recursive: true, force: true });
    console.log(`Copied ${directory} to dist/${directory}`);
  }
}
