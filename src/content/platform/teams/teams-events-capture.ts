// Presença/eventos do Microsoft Teams: participantes (roster), mão levantada e reações.
//
// >>> AJUSTE AQUI se o DOM do Teams mudar <<<
//  - Roster (painel "Pessoas"): [data-tid^="attendeesInMeeting-<NOME>"] — nome no próprio tid;
//    aria-label traz "levantada à mão" quando a pessoa levanta a mão.
//  - Reação: nó efêmero [data-tid="participant-reaction"] adicionado ao DOM.
//
// Observações: o roster/mão-levantada só são lidos com o painel "Pessoas" aberto (o Teams só
// renderiza a lista aí). Atribuição de quem/qual emoji na reação é best-effort.

import { store, cryptoRandomId } from '@/services/store';
import type { TranscriptEntry } from '@/types';
import { t } from '@/i18n';
import type { ChatController } from '../types';

const ROSTER_ITEM = '[data-tid^="attendeesInMeeting-"]';
const REACTION = '[data-tid="participant-reaction"]';
const RE_HAND = /levantad[ao] à mão|levantou a mão|m[ãa]o levantada|hand raised|raised .*hand/i;
const RE_NOT_NAME = /rea(ç|c)(ão|ao|t|ci)|reagi|emoji|placeholder/i;
const REACTION_DEDUP_MS = 2500;

export class TeamsEventsCapture implements ChatController {
  private pollId: number | null = null;
  private observer: MutationObserver | null = null;
  private raised = new Set<string>();
  private lastReactAt = new Map<string, number>();
  private running = false;

  start() {
    if (this.running) return;
    this.running = true;
    this.pollId = window.setInterval(() => this.scanRoster(), 2000);
    this.scanRoster();
    this.observer = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of Array.from(m.addedNodes)) {
          if (node.nodeType !== 1) continue;
          const el = node as Element;
          const r = el.matches?.(REACTION) ? el : el.querySelector?.(REACTION);
          if (r) this.onReaction(r);
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
    this.raised.clear();
    this.lastReactAt.clear();
  }

  /** Registra os participantes do roster (inclui quem não falou) e detecta mãos levantadas. */
  private scanRoster() {
    const rows = document.querySelectorAll(ROSTER_ITEM);
    const nowRaised = new Set<string>();
    for (const row of Array.from(rows)) {
      const tid = row.getAttribute('data-tid') || '';
      const name = tid.slice('attendeesInMeeting-'.length).trim();
      if (!name) continue;
      store.registerParticipant({ name });
      if (RE_HAND.test(row.getAttribute('aria-label') || '')) {
        nowRaised.add(name);
        if (!this.raised.has(name)) this.emit(name, t().events.raisedHand);
      }
    }
    this.raised = nowRaised;
  }

  private onReaction(node: Element) {
    // Quem reagiu: sobe procurando um aria-label que pareça um nome (não "reação/emoji").
    let name = '';
    let a: Element | null = node;
    for (let i = 0; i < 6 && a && !name; i++) {
      const al = a.getAttribute?.('aria-label') || '';
      if (al && !RE_NOT_NAME.test(al) && /[A-Za-zÀ-ÿ]{2,}/.test(al)) name = al.split(',')[0]!.trim();
      a = a.parentElement;
    }
    // Emoji: espera renderizar (via CSS/img).
    window.setTimeout(() => {
      let emoji = (node.textContent || '').trim();
      if (!emoji) emoji = (node.querySelector('img') as HTMLImageElement | null)?.alt || '';
      if (!emoji || emoji.length > 4) emoji = '👍';
      const key = name || '·anon';
      const now = Date.now();
      if (now - (this.lastReactAt.get(key) || 0) < REACTION_DEDUP_MS) return;
      this.lastReactAt.set(key, now);
      this.emit(name || t().events.someone, t().events.reacted(emoji));
    }, 250);
  }

  private emit(name: string, text: string) {
    const entry: TranscriptEntry = {
      id: cryptoRandomId(),
      participantName: name,
      text,
      capturedAt: new Date().toISOString(),
      source: 'microsoft-teams-event',
    };
    store.upsertEntry(entry);
  }
}
