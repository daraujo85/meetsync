// Núcleo i18n próprio (sem chrome.i18n — este permite trocar o idioma em runtime, o que a API
// do Chrome não faz). `t()` devolve o dicionário do idioma ativo (tipado). A preferência é
// detectada de navigator.language no primeiro uso e pode ser sobrescrita pelo seletor (settings).

import { pt, type Messages } from './locales/pt';
import { en } from './locales/en';
import { es } from './locales/es';

export type Locale = 'pt' | 'en' | 'es';

export const LOCALES: Locale[] = ['pt', 'en', 'es'];

const DICTS: Record<Locale, Messages> = { pt, en, es };

let current: Locale = 'en';

/** Idioma do navegador mapeado para um dos suportados (fallback 'en'). */
export function detectLocale(): Locale {
  const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]) || [];
  for (const raw of langs) {
    const code = (raw || '').toLowerCase();
    if (code.startsWith('pt')) return 'pt';
    if (code.startsWith('es')) return 'es';
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

export function setLocale(locale: Locale | undefined | null): void {
  if (locale && LOCALES.includes(locale)) current = locale;
}

export function getLocale(): Locale {
  return current;
}

/** Resolve o locale efetivo a partir das settings: usa o salvo ou detecta do navegador. */
export function resolveLocale(saved: Locale | undefined): Locale {
  return saved && LOCALES.includes(saved) ? saved : detectLocale();
}

/** Dicionário do idioma ativo. Uso: `t().panel.x`, `t().history.count(n)`. */
export function t(): Messages {
  return DICTS[current];
}

/** BCP-47 do idioma ativo, para toLocaleString/Intl. */
export function bcp47(): string {
  return DICTS[current]._bcp47;
}

/** Rótulo/descrição localizados de uma regra-semente de alerta (por id), ou null se não for semente. */
export function seedWatchText(id: string): { label: string; desc?: string } | null {
  const s = t().seedWatch;
  switch (id) {
    case 'w-name': return { label: s.nameLabel };
    case 'w-shared': return { label: s.sharedLabel, desc: s.sharedDesc };
    case 'w-decision': return { label: s.decisionLabel, desc: s.decisionDesc };
    default: return null;
  }
}

export type { Messages };
