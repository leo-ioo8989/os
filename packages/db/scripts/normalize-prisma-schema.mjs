import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '../prisma/schema.prisma');
const source = readFileSync(schemaPath, 'utf8');

const normalized = source.replace(
  /enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([^{}\n]+)\}/g,
  (_match, name, body) => {
    const values = body.trim().split(/\s+/).filter(Boolean);
    return `enum ${name} {\n${values.map((value) => `  ${value}`).join('\n')}\n}`;
  },
);

if (normalized !== source) {
  writeFileSync(schemaPath, normalized, 'utf8');
  console.log(`Normalized Prisma enum declarations in ${schemaPath}`);
} else {
  console.log(`Prisma schema already normalized: ${schemaPath}`);
}
