// Eventos do Google Meet: mão levantada e reações → viram entradas na transcrição.
//
// >>> AJUSTE AQUI se o DOM do Meet mudar <<<
//  - Mão própria: botão da barra vira "Abaixar a mão" / "Lower hand" quando você levanta.
//  - Mão de outros: best-effort — varre aria-label/textos por "levantou a mão" (painel Pessoas).
//  - Reação: nó <img aria-label="👍"> (o emoji vem no aria-label; classe ofuscada, ex.: RGrnrd).

import { store, cryptoRandomId } from '@/services/store';
import type { TranscriptEntry } from '@/types';
import { t } from '@/i18n';
import type { ChatController } from '../types';
import { isEmojiOnly, resolveEmoji } from '../reaction-util';

const SELF_HAND_BTN = ['button[aria-label*="abaixar a mão" i]', 'button[aria-label*="lower hand" i]'];
// "outros levantaram a mão" — evita casar com o botão próprio "Abaixar a mão".
const RE_HAND_OTHER = /levantou a m[ãa]o|com a m[ãa]o levantada|m[ãa]o levantada|raised (their )?hand|hand is raised/i;
const REACTION_DEDUP_MS = 1200;

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

function selfLabel(): string {
  return store.get().settings.selfName.trim() || 'Você';
}

export class MeetEventsCapture implements ChatController {
  private pollId: number | null = null;
  private observer: MutationObserver | null = null;
  private running = false;
  private selfRaised = false;
  private raisedOthers = new Set<string>();
  private lastReactAt = new Map<string, number>();

  start() {
    if (this.running) return;
    this.running = true;
    this.pollId = window.setInterval(() => this.scanHands(), 2000);
    this.scanHands();
    this.observer = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of Array.from(m.addedNodes)) {
          if (node.nodeType !== 1) continue;
          const el = node as Element;
          if (el.tagName === 'IMG') this.maybeReaction(el);
          el.querySelectorAll?.('img[aria-label]').forEach((img) => this.maybeReaction(img));
        }
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stop() {
    this.running = false;
    if (this.pollId !== null) clearInterval(this.pollId);
    this.pollId = null;
    this.observer?.disconnect();
    this.observer = null;
    this.selfRaised = false;
    this.raisedOthers.clear();
    this.lastReactAt.clear();
  }

  private scanHands() {
    // Mão própria (botão da barra vira "Abaixar a mão").
    const selfUp = queryAny(SELF_HAND_BTN) != null;
    if (selfUp && !this.selfRaised) this.emit(selfLabel(), t().events.raisedHand);
    this.selfRaised = selfUp;

    // Mão de outros (best-effort: aria-label/text com "levantou a mão" + nome antes da vírgula).
    const now = new Set<string>();
    for (const el of Array.from(document.querySelectorAll('[aria-label]'))) {
      const al = el.getAttribute('aria-label') || '';
      if (!RE_HAND_OTHER.test(al)) continue;
      const name = al.split(',')[0]!.trim();
      if (name && name.length < 60 && !RE_HAND_OTHER.test(name) && /[A-Za-zÀ-ÿ]{2,}/.test(name)) now.add(name);
    }
    for (const n of now) if (!this.raisedOthers.has(n)) this.emit(n, t().events.raisedHand);
    this.raisedOthers = now;
  }

  private maybeReaction(img: Element) {
    const label = (img.getAttribute('aria-label') || '').trim();
    if (!isEmojiOnly(label)) return;
    // Ignora o seletor de reações (botões/menu) — só a reação flutuante conta.
    if (img.closest('button,[role="button"],[role="menu"],[role="menuitem"]')) return;

    const emoji = resolveEmoji(label);
    // Quem reagiu: nome no ancestral mais próximo (não emoji / não "reação").
    let name = '';
    let a: Element | null = img;
    for (let i = 0; i < 6 && a && !name; i++) {
      const al = a.getAttribute?.('aria-label') || '';
      if (al && !isEmojiOnly(al) && !/rea(ç|c)/i.test(al) && /[A-Za-zÀ-ÿ]{2,}/.test(al)) name = al.split(',')[0]!.trim();
      a = a.parentElement;
    }
    const key = `${name || '·anon'}|${emoji}`;
    const nowMs = Date.now();
    if (nowMs - (this.lastReactAt.get(key) || 0) < REACTION_DEDUP_MS) return;
    this.lastReactAt.set(key, nowMs);
    this.emit(name || t().events.someone, t().events.reacted(emoji));
  }

  private emit(name: string, text: string) {
    const entry: TranscriptEntry = {
      id: cryptoRandomId(),
      participantName: name,
      text,
      capturedAt: new Date().toISOString(),
      source: 'google-meet-event',
    };
    store.upsertEntry(entry);
  }
}
