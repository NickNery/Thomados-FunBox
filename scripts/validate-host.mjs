import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'acorn';

const hostPath = resolve('host', 'host.jsx');
const source = await readFile(hostPath, 'utf8');

try {
  parse(source, {
    ecmaVersion: 3,
    allowReserved: false
  });
  console.log('host/host.jsx is valid ECMAScript 3.');
} catch (error) {
  const location = error.loc ? `:${error.loc.line}:${error.loc.column}` : '';
  console.error(`Invalid ExtendScript syntax in ${hostPath}${location}: ${error.message}`);
  process.exitCode = 1;
}
