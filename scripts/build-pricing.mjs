// Preserve the Website branch's static deployment layout; only generate engine files.
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir(new URL('../dist/domain/', import.meta.url), { recursive: true });
await copyFile(new URL('../src/domain/decimal.mjs', import.meta.url), new URL('../dist/domain/decimal.mjs', import.meta.url));
await copyFile(new URL('../src/domain/decide.mjs', import.meta.url), new URL('../dist/pricing.mjs', import.meta.url));
// Source-relative decimal module lives under dist/domain for the static browser build.
import { readFile, writeFile } from 'node:fs/promises';
const target = new URL('../dist/pricing.mjs', import.meta.url);
await writeFile(target, (await readFile(target, 'utf8')).replace("'./decimal.mjs'", "'./domain/decimal.mjs'"));

await writeFile(new URL("../dist/domain/dynamic.mjs",import.meta.url), (await readFile(new URL("../src/domain/dynamic.mjs",import.meta.url),"utf8")).replace("'./decide.mjs'", "'../pricing.mjs'"));
