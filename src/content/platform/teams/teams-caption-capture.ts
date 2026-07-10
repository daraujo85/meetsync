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
  container: [
    '[data-tid="closed-caption-v2-virtual-list-content"]',
    '[data-tid="closed-caption-renderer-wrapper"]',
  ],
  line: '.fui-ChatMessageCompact',
  author: '[data-tid="author"]',
  text: '[data-tid="closed-caption-text"]',
  moreButton: '#callingButtons-showMoreBtn',
  captionsMenuItem: ['[role="menuitem"][aria-label="Legendas" i]', '[aria-label="Legendas" i]'],
  turnOff: ['[data-tid="closed-captions-turn-off-button"]', '#captions-panel-dismiss-button'],
};

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

  /** Liga as legendas do Teams (menu "Mais" → "Legendas"). Assíncrono: o menu renderiza depois. */
  tryEnableCaptions(): boolean {
    if (this.captionsOn()) return true;
    const more = document.querySelector(SELECTORS.moreButton) as HTMLElement | null;
    if (!more) return false;
    more.click();
    window.setTimeout(() => {
      let item = queryAny(SELECTORS.captionsMenuItem) as HTMLElement | null;
      if (!item) {
        item = ([...document.querySelectorAll('[role="menuitem"],[role="menuitemcheckbox"]')].find((e) =>
          /legenda|caption/i.test(e.textContent || ''),
        ) as HTMLElement | undefined) ?? null;
      }
      item?.click();
    }, 500);
    return true;
  }

  toggleCaptions() {
    if (this.captionsOn()) {
      const off = queryAny(SELECTORS.turnOff) as HTMLElement | null;
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
  private harvest() {
    if (!this.container) return;
    const rows = this.container.querySelectorAll(SELECTORS.line);
    for (const row of Array.from(rows)) {
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
