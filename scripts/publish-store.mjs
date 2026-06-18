// Sobe o meetsync-<versão>.zip como RASCUNHO na Chrome Web Store (não publica sozinho —
// o item fica pronto para você clicar em "Publicar" no Developer Dashboard).
//
// Credenciais via variáveis de ambiente (NUNCA commitar):
//   EXTENSION_ID, CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, PUBLISHER_ID
// Veja RELEASING.md para como obtê-las. Usado localmente (`npm run publish:store`)
// e pelo workflow .github/workflows/release.yml.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const zip = resolve(root, `meetsync-${pkg.version}.zip`);

// Em CI: garante que a tag (v1.2.3) bate com a versão do package.json.
const tag = process.env.GITHUB_REF_NAME;
if (tag && tag !== `v${pkg.version}`) {
  console.error(`✗ Tag ${tag} != versão do package.json (v${pkg.version}). Sincronize antes de publicar.`);
  process.exit(1);
}

if (!existsSync(zip)) {
  console.error(`✗ ${zip} não encontrado. Rode \`npm run package\` antes.`);
  process.exit(1);
}

// PUBLISHER_ID só é necessário para publicar em nome de um publisher de grupo/domínio;
// para conta individual não é exigido (passado adiante se existir).
const required = ['EXTENSION_ID', 'CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`✗ Faltam variáveis de ambiente: ${missing.join(', ')} (veja RELEASING.md).`);
  process.exit(1);
}

console.log(`Subindo ${zip} como rascunho na Chrome Web Store…`);
try {
  // `upload` apenas envia o pacote (vira rascunho). Sem `publish`, nada vai para
  // revisão automaticamente. A CLI (chrome-webstore-upload-cli, devDependency) lê as
  // credenciais das env vars acima; --extension-id também aceita a env EXTENSION_ID.
  execFileSync('npx', ['chrome-webstore-upload', 'upload', '--source', zip], { stdio: 'inherit' });
  console.log('✓ Upload concluído. Publique manualmente no Developer Dashboard quando quiser.');
} catch (err) {
  console.error('✗ Falha no upload para a Chrome Web Store.', err.message);
  process.exit(1);
}
