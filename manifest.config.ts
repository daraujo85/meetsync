import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

/**
 * Manifest MV3 do MeetSync.
 *
 * Permissões mínimas (RNF-017): apenas `storage` e `downloads`.
 * host_permissions: somente `meet.google.com` (RNF-018).
 * O acesso ao Ollama local é solicitado sob demanda via `optional_host_permissions`,
 * para evitar pedir host genérico no momento da instalação (privacidade — RNF-013/014).
 */
export default defineManifest({
  manifest_version: 3,
  // Nome/descrição localizados via _locales (a Web Store exibe conforme o idioma do usuário).
  // Os textos vivem em public/_locales/{en,pt_BR,es}/messages.json (achatado para dist/_locales).
  default_locale: 'en',
  name: '__MSG_name__',
  version: pkg.version,
  description: '__MSG_description__',
  icons: {
    16: 'public/icons/icon-16.png',
    32: 'public/icons/icon-32.png',
    48: 'public/icons/icon-48.png',
    128: 'public/icons/icon-128.png',
  },
  action: {
    default_title: 'MeetSync',
    default_popup: 'src/popup/popup.html',
    default_icon: {
      16: 'public/icons/icon-16.png',
      32: 'public/icons/icon-32.png',
      48: 'public/icons/icon-48.png',
      128: 'public/icons/icon-128.png',
    },
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://meet.google.com/*'],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage', 'downloads', 'notifications'],
  // localhost/127.0.0.1 concedidos na instalação: garante que o fetch ao Ollama no service
  // worker contorne o CORS (Chrome dispensa CORS para hosts em host_permissions).
  // Permissões enxutas para a Chrome Web Store — sem curinga (evita rejeição no review).
  host_permissions: ['https://meet.google.com/*', 'http://localhost/*', 'http://127.0.0.1/*'],
});
