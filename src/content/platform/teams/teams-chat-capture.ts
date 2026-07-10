// Captura das mensagens do chat da reunião do Microsoft Teams — MÓDULO ISOLADO.
//
// >>> AJUSTE AQUI se o DOM do Teams mudar <<<
// Estrutura confirmada ao vivo (teams.cloud.microsoft, jul/2026):
//   [data-tid="message-pane-list-runway"]        -> lista (só existe com o chat aberto)
//     [data-tid="chat-pane-item"]                -> item
//       [data-tid="message-author-name"]         -> autor
//       time[datetime]                           -> horário (ISO)
//       [data-tid="chat-pane-message"][data-mid] -> corpo da msg (id ÚNICO -> dedup); texto em #content-<mid>
//
// O chat de reunião do Teams exige usuário AUTENTICADO (convidado anônimo não tem chat).
// A extensão não força a abertura do painel (paridade com o Meet): captura quando ele está aberto.

import { store } from '@/services/store';
import { resolveSelfName } from '../../participant-resolver';
import type { TranscriptEntry } from '@/types';
import type { ChatController } from '../types';

const SELECTORS = {
  container: ['[data-tid="message-pane-list-runway"]'],
  message: '[data-tid="chat-pane-message"]',
  item: '[data-tid="chat-pane-item"]',
  author: '[data-tid="message-author-name"]',
};

const DEBOUNCE_MS = 300;

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

function cleanText(root: Element): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.tagName === 'I' || p.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
      if (p.closest('button,[role="button"],time')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let out = '';
  let n = walker.nextNode();
  while (n) {
    out += ' ' + (n.textContent ?? '');
    n = walker.nextNode();
  }
  return out.replace(/\s+/g, ' ').trim();
}

export class TeamsChatCapture implements ChatController {
  private observer: MutationObserver | null = null;
  private container: Element | null = null;
  private pollId: number | null = null;
  private debounceId: number | null = null;
  private seen = new Set<string>();
  private running = false;

  start() {
    if (this.running) return;
    this.running = true;
    this.pollId = window.setInterval(() => this.syncContainer(), 1500);
    this.syncContainer();
  }

  stop() {
    this.running = false;
    this.observer?.disconnect();
    this.observer = null;
    if (this.pollId !== null) clearInterval(this.pollId);
    if (this.debounceId !== null) clearTimeout(this.debounceId);
    this.pollId = null;
    this.debounceId = null;
    this.container = null;
    this.seen.clear();
  }

  private syncContainer() {
    const container = queryAny(SELECTORS.container);
    if (container && container !== this.container) {
      this.observer?.disconnect();
      this.container = container;
      this.observer = new MutationObserver(() => this.schedule());
      this.observer.observe(container, { childList: true, subtree: true, characterData: true });
      this.harvest();
    } else if (!container && this.container) {
      this.observer?.disconnect();
      this.observer = null;
      this.container = null;
    }
  }

  private schedule() {
    if (this.debounceId !== null) clearTimeout(this.debounceId);
    this.debounceId = window.setTimeout(() => this.harvest(), DEBOUNCE_MS);
  }

  private harvest() {
    if (!this.container) return;
    const messages = this.container.querySelectorAll(SELECTORS.message);
    for (const msg of Array.from(messages)) {
      const mid = msg.getAttribute('data-mid');
      if (!mid || this.seen.has(mid)) continue;

      // Texto: elemento #content-<mid> se existir; senão, texto limpo do corpo da mensagem.
      const contentEl = document.getElementById(`content-${mid}`) ?? msg;
      const text = cleanText(contentEl);
      if (!text) continue;

      this.seen.add(mid);

      const item = msg.closest(SELECTORS.item) ?? msg.parentElement ?? msg;
      const authorEl = item.querySelector(SELECTORS.author);
      let name = (authorEl?.textContent || '').replace(/\s+/g, ' ').trim() || 'Você';
      name = resolveSelfName(name, store.get().settings.selfName);
      const timeEl = item.querySelector('time');
      const iso = timeEl?.getAttribute('datetime') || new Date().toISOString();

      const entry: TranscriptEntry = {
        id: `chat:${mid}`,
        participantName: name,
        text,
        capturedAt: iso,
        source: 'microsoft-teams-chat',
      };
      store.upsertEntry(entry);
    }
  }
}
