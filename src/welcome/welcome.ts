// Localiza a página de boas-vindas (estática). Lê o idioma salvo (ou detecta do navegador) e
// preenche os nós marcados com id. Usa innerHTML só nos trechos com <strong> dos próprios
// dicionários (conteúdo controlado, não vem do usuário).

import { loadSettings } from '@/services/storage-service';
import { t, bcp47, setLocale, resolveLocale } from '@/i18n';

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function setHtml(id: string, html: string) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

async function init() {
  const settings = await loadSettings();
  setLocale(resolveLocale(settings.locale));
  document.documentElement.lang = bcp47();

  const w = t().welcome;
  setText('ms-doc-title', w.docTitle);
  document.title = w.docTitle;
  setText('ms-tagline', w.tagline);
  setText('ms-howto', w.howToUse);
  setHtml('ms-step1', w.step1Html);
  setHtml('ms-step2', w.step2Html);
  setHtml('ms-step3', w.step3Html);
  setHtml('ms-step4', w.step4Html);
  setText('ms-capture-note', w.captureNote);
  setText('ms-cta', w.goToMeet);
  setText('ms-priv', w.privacy);
  setText('ms-privacy-link', w.privacyPolicy);
}

void init();
