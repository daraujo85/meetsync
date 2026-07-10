// Captura das legendas ao vivo do Microsoft Teams — MÓDULO ISOLADO e de maior risco.
//
// >>> AJUSTE AQUI quando o DOM do Teams mudar <<<
// Estrutura confirmada ao vivo (teams.cloud.microsoft, jul/2026):
//   [data-tid="closed-caption-v2-virtual-list-content"]   -> lista (VIRTUALIZADA: linhas antigas somem)
//     .fui-ChatMessageCompact                              -> uma linha de fala
//       [data-tid="author"]                                -> nome do autor (nome real, sem "Você")
//       [data-tid="closed-caption-text"]                   -> texto da fala (atualiza in-place: interim -> final)
// Ligar legendas: #callingButtons-showMoreBtn (menu "Mais") -> item "Legendas".
// Estado ligado: existe [data-tid="closed-captions-turn-off-button"] / #captions-panel-dismiss-button.

import { store, cryptoRandomId } from '@/services/store';
import type { TranscriptEntry } from '@/types';
import { resolveSelfName } from '../../participant-resolver';
import type { CaptionController } from '../types';

const SELECTORS = {
  // Wrapper externo PRIMEIRO: contém todas as linhas independentemente do aninhamento interno
  // (o cliente autenticado adiciona um "closed-captions-v2-items-renderer" a mais).
  container: [
    '[data-tid="closed-caption-renderer-wrapper"]',
    '[data-tid="closed-caption-v2-window-wrapper"]',
    '[data-tid="closed-caption-v2-virtual-list-content"]',
  ],
  line: '.fui-ChatMessageCompact',
  author: '[data-tid="author"]',
  text: '[data-tid="closed-caption-text"]',
  // Botão direto de ligar/desligar legendas (barra lateral / tooltip "Ligar/desligar legendas").
  // É o caminho mais confiável; evita "Configurações/Estilo da legenda".
  captionToggle: [
    'button[aria-label*="ligar/desligar legenda" i]',
    'button[aria-label*="legendas ao vivo" i]',
    'button[aria-label*="live caption" i]',
    'button[aria-label*="turn on caption" i]',
    'button[title*="ligar/desligar legenda" i]',
    'button[title*="legendas ao vivo" i]',
  ],
  moreButton: '#callingButtons-showMoreBtn',
  turnOff: ['[data-tid="closed-captions-turn-off-button"]', '#captions-panel-dismiss-button'],
};

const RE_LANG = /idioma e fala|language and speech/i;
const RE_TURN_ON = /ativar legendas|legendas ao vivo|turn on live caption|live caption/i;
const RE_CAPTIONS = /^legendas$|captions/i;
const RE_AVOID = /configura|estilo|style|settings/i;

/** Acha um item de menu (role menuitem) cujo texto/aria casa `re` e não casa RE_AVOID. */
function findMenuItem(re: RegExp): HTMLElement | null {
  const items = document.querySelectorAll('[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]');
  for (const it of Array.from(items)) {
    const s = `${it.textContent || ''} ${it.getAttribute('aria-label') || ''}`;
    if (re.test(s) && !RE_AVOID.test(s)) return it as HTMLElement;
  }
  return null;
}

const DEBOUNCE_MS = 300;
const MIN_TEXT_LEN = 1;

type OpenEntry = { id: string; name: string; text: string; capturedAt: string };

function queryAny(selectors: string[]): Element | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch {
      /* ignora */
    }
  }
  return null;
}

function normU(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:…"']+/g, '').replace(/\s+/g, ' ').trim();
}

/** Mesma fala? (uma é prefixo da outra ou compartilham prefixo longo) — tolerante a pontuação. */
function sameUtterance(a: string, b: string): boolean {
  const x = normU(a);
  const y = normU(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const lo = x.length <= y.length ? x : y;
  const hi = x.length <= y.length ? y : x;
  if (lo.length < 12) return false;
  if (hi.startsWith(lo)) return true;
  let i = 0;
  const max = Math.min(lo.length, hi.length);
  while (i < max && lo[i] === hi[i]) i++;
  return i >= Math.min(40, Math.floor(lo.length * 0.8));
}

function longer(a: string, b: string): string {
  return a.length >= b.length ? a : b;
}

export class TeamsCaptionCapture implements CaptionController {
  private observer: MutationObserver | null = null;
  private debounceId: number | null = null;
  private stateTimer: number | null = null;
  private container: Element | null = null;
  private rowToEntry = new WeakMap<Element, OpenEntry>();
  private running = false;

  start() {
    if (this.running) return;
    this.running = true;
    this.stateTimer = window.setInterval(() => this.syncCaptionState(), 1500);
    this.syncCaptionState();
  }

  stop() {
    this.running = false;
    this.detachObserver();
    if (this.stateTimer !== null) clearInterval(this.stateTimer);
    this.stateTimer = null;
    this.container = null;
    this.rowToEntry = new WeakMap();
  }

  private captionsOn(): boolean {
    return queryAny(SELECTORS.container) != null || queryAny(SELECTORS.turnOff) != null;
  }

  /** Liga as legendas do Teams. 1º tenta o botão direto (CC); senão, menu "Mais" →
   *  "Idioma e fala" → "Ativar legendas ao vivo" (layout autenticado) ou "Legendas" (light). */
  tryEnableCaptions(): boolean {
    if (this.captionsOn()) return true;

    // Caminho preferido: botão de toggle direto.
    const toggle = queryAny(SELECTORS.captionToggle) as HTMLElement | null;
    if (toggle) {
      toggle.click();
      return true;
    }

    // Fallback: menu "Mais".
    const more = document.querySelector(SELECTORS.moreButton) as HTMLElement | null;
    if (!more) return false;
    more.click();
    window.setTimeout(() => {
      // Layout light (convidado): "Legendas" direto no menu.
      const direct = findMenuItem(RE_CAPTIONS) || findMenuItem(RE_TURN_ON);
      if (direct) {
        direct.click();
        return;
      }
      // Layout autenticado: abre o submenu "Idioma e fala" e clica em "Ativar legendas ao vivo".
      const lang = findMenuItem(RE_LANG);
      if (lang) {
        lang.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        lang.click();
        window.setTimeout(() => findMenuItem(RE_TURN_ON)?.click(), 500);
      }
    }, 500);
    return true;
  }

  toggleCaptions() {
    if (this.captionsOn()) {
      // Desliga pelo mesmo botão de toggle (se houver) ou pelo botão de desligar do painel.
      const toggle = queryAny(SELECTORS.captionToggle) as HTMLElement | null;
      const off = (queryAny(SELECTORS.turnOff) as HTMLElement | null) ?? toggle;
      off?.click();
    } else {
      this.tryEnableCaptions();
    }
    window.setTimeout(() => this.syncCaptionState(), 700);
  }

  private syncCaptionState() {
    const container = queryAny(SELECTORS.container);
    const on = container != null || queryAny(SELECTORS.turnOff) != null;
    store.setCaptionsOn(on);

    if (on && container) {
      if (this.container !== container) {
        this.detachObserver();
        this.container = container;
        this.attachObserver(container);
      }
      if (store.get().inMeeting) {
        store.setCaptureStartedAt(new Date().toISOString());
        if (store.get().captureStatus !== 'processing') store.setCaptureStatus('capturing');
      }
      this.harvest();
    } else {
      this.detachObserver();
      this.container = null;
      this.rowToEntry = new WeakMap();
      if (store.get().inMeeting && store.get().captureStatus !== 'processing') {
        store.setCaptureStatus('waiting');
      }
    }
  }

  private attachObserver(container: Element) {
    this.observer = new MutationObserver(() => this.scheduleHarvest());
    this.observer.observe(container, { childList: true, subtree: true, characterData: true });
  }

  private detachObserver() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.debounceId !== null) clearTimeout(this.debounceId);
    this.debounceId = null;
  }

  private scheduleHarvest() {
    if (this.debounceId !== null) clearTimeout(this.debounceId);
    this.debounceId = window.setTimeout(() => this.harvest(), DEBOUNCE_MS);
  }

  /** Lê as linhas visíveis. A lista é virtualizada: cada nó de linha -> uma entrada (WeakMap);
   *  o texto atualiza in-place enquanto a fala é refinada. Linhas que saem do DOM já foram salvas. */
  /** Linhas de legenda, robusto ao aninhamento: procura dentro do container e, se vazio,
   *  varre o documento por linhas que contenham o texto de legenda (`closed-caption-text`). */
  private captionRows(): Element[] {
    let rows = this.container ? Array.from(this.container.querySelectorAll(SELECTORS.line)) : [];
    if (rows.length === 0) {
      rows = Array.from(document.querySelectorAll(SELECTORS.line)).filter((r) => r.querySelector(SELECTORS.text));
    }
    // Só linhas que realmente têm texto de legenda (evita casar com mensagens do chat).
    return rows.filter((r) => r.querySelector(SELECTORS.text));
  }

  private harvest() {
    if (!this.container) return;
    const rows = this.captionRows();
    for (const row of rows) {
      const textEl = row.querySelector(SELECTORS.text);
      if (!textEl) continue;
      const text = (textEl.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < MIN_TEXT_LEN) continue;

      const authorEl = row.querySelector(SELECTORS.author);
      let name = (authorEl?.textContent || '').replace(/\s+/g, ' ').trim() || 'Participante';
      name = resolveSelfName(name, store.get().settings.selfName);
      const avatarUrl = (row.querySelector('img') as HTMLImageElement | null)?.src || undefined;

      let open = this.rowToEntry.get(row);
      const isNew = !open || open.name !== name || text.length + 8 < open.text.length;

      if (isNew) {
        const transcript = store.get().session.transcript;
        const last = transcript[transcript.length - 1];
        if (last && last.participantName === name && sameUtterance(last.text, text)) {
          open = { id: last.id, name, text: longer(last.text, text), capturedAt: last.capturedAt };
        } else {
          open = { id: cryptoRandomId(), name, text, capturedAt: new Date().toISOString() };
        }
        this.rowToEntry.set(row, open);
      } else {
        open!.name = name;
        open!.text = text;
      }

      const entry: TranscriptEntry = {
        id: open!.id,
        participantName: name,
        participantAvatarUrl: avatarUrl,
        text: open!.text,
        capturedAt: open!.capturedAt,
        source: 'microsoft-teams-caption',
      };
      store.upsertEntry(entry);
    }
  }
}
