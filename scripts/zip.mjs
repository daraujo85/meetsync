// Empacota a pasta dist/ em meetsync-<versão>.zip (RF-002) usando apenas o `zip` do sistema.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

if (!existsSync(dist)) {
  console.error('✗ dist/ não encontrada. Rode `npm run build` antes de `npm run zip`.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const out = resolve(root, `meetsync-${pkg.version}.zip`);

if (existsSync(out)) rmSync(out);

try {
  // -r recursivo, -X sem atributos extras, executado de dentro de dist/ para zipar sem o prefixo "dist/".
  execFileSync('zip', ['-rqX', out, '.'], { cwd: dist, stdio: 'inherit' });
  console.log(`✓ Pacote gerado: ${out}`);
} catch (err) {
  console.error('✗ Falha ao gerar zip. O utilitário `zip` está instalado?', err.message);
  process.exit(1);
}
