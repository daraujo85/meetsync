// Captura das MENSAGENS DE TEXTO do chat do Google Meet — MÓDULO ISOLADO.
//
// >>> AJUSTE AQUI se o DOM do Meet mudar <<<
// Estrutura confirmada ao vivo (jun/2026):
//   div[jsname="xySENc"][aria-live="polite"]            -> lista de mensagens (só existe com o chat aberto)
//     div[jsname="Ypafjf"]                              -> grupo por remetente (header com nome + horário)
//       ...
//       div[data-message-id="spaces/.../messages/..."]  -> uma mensagem (id ÚNICO -> dedup perfeito)
//         [jsname="dTKtvb"]                              -> texto da mensagem
//
// Observação: o chat precisa estar ABERTO para o Meet renderizar a lista. Sem isso, não há o
// que capturar (a extensão não força a abertura para não atrapalhar o usuário).

import { store } from '@/services/store';
import type { TranscriptEntry } from '@/types';

const SELECTORS = {
  container: [
    'div[jsname="xySENc"][aria-live="polite"]',
    'div[aria-live="polite"][jscontroller="Mzzivb"]',
    'div[aria-live="polite"][aria-label*="mensagen" i]',
    'div[aria-live="polite"][aria-label*="message" i]',
  ],
  message: '[data-message-id]',
  messageText: '[jsname="dTKtvb"]',
  group: '[jsname="Ypafjf"]',
  // Botão do chat: jsname="A5il2e" NÃO é único (Ferramentas usa o mesmo); o chat é data-panel-id="2".
  chatButton: [
    'button[jsname="A5il2e"][data-panel-id="2"]',
    'button[aria-label^="Chat com" i]',
    'button[data-panel-id="2"][role="button"]',
  ],
  // Container do botão (wrapper) — onde fica a bolinha de não-lida.
  chatButtonWrap: '[jscontroller="rYZP8b"]',
  unreadDot: '[jscontroller="fIa6jf"], .IxCbn',
};

const TIME_RE = /\b(\d{1,2}):(\d{2})\b/;
// aria-label do botão de chat quando há mensagem não lida.
const UNREAD_LABEL_RE = /nova mensagem|new message|não lida|unread/i;
const DEBOUNCE_MS = 300;

function queryAny(selectors: string[]): Element | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Texto limpo de um nó, ignorando ícones (<i>), aria-hidden e botões. */
function cleanText(root: Element): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.tagName === 'I') return NodeFilter.FILTER_REJECT;
      if (p.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
      if (p.closest('button,[role="button"]')) return NodeFilter.FILTER_REJECT;
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

/** Converte "HH:MM" no horário de hoje para ISO; sem horário, usa agora. */
function timeToIso(hhmm: string | null): string {
  if (hhmm) {
    const m = hhmm.match(TIME_RE);
    if (m) {
      const d = new Date();
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
      return d.toISOString();
    }
  }
  return new Date().toISOString();
}

export class ChatCapture {
  private observer: MutationObserver | null = null;
  private container: Element | null = null;
  private pollId: number | null = null;
  private debounceId: number | null = null;
  private seen = new Set<string>();
  private running = false;
  private lastOpenAttempt = 0;

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

  /** Abre o chat automaticamente quando o Meet indica mensagem não lida (RF: captura do chat). */
  private maybeAutoOpen() {
    if (!store.get().settings.autoOpenChat) return;
    if (this.container) return; // chat já aberto
    if (!this.hasUnread()) return;
    const now = Date.now();
    if (now - this.lastOpenAttempt < 3000) return; // evita clique repetido
    const btn = queryAny(SELECTORS.chatButton) as HTMLElement | null;
    if (btn) {
      this.lastOpenAttempt = now;
      btn.click();
    }
  }

  /** Há mensagem não lida? Detecta pelo aria-label do botão ou pela bolinha visível. */
  private hasUnread(): boolean {
    const btn = queryAny(SELECTORS.chatButton);
    if (!btn) return false;
    if (UNREAD_LABEL_RE.test(btn.getAttribute('aria-label') ?? '')) return true;
    const wrap = btn.closest(SELECTORS.chatButtonWrap) ?? btn.parentElement?.parentElement ?? null;
    const dot = wrap?.querySelector(SELECTORS.unreadDot) as HTMLElement | null;
    return !!dot && dot.style.display !== 'none' && dot.offsetParent !== null;
  }

  /** Liga/desliga o observer conforme o painel de chat aparece/some. */
  private syncContainer() {
    this.maybeAutoOpen();
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

  /** Lê as mensagens do chat e adiciona as novas à transcrição (dedup por data-message-id). */
  private harvest() {
    if (!this.container) return;
    const messages = this.container.querySelectorAll(SELECTORS.message);
    for (const msg of Array.from(messages)) {
      const id = msg.getAttribute('data-message-id');
      if (!id || this.seen.has(id)) continue;

      const textEl = msg.querySelector(SELECTORS.messageText) ?? msg;
      const text = cleanText(textEl);
      if (!text) continue;

      this.seen.add(id);

      const { name, time } = this.parseSender(msg);
      const entry: TranscriptEntry = {
        id: `chat:${id}`,
        participantName: name,
        text,
        capturedAt: timeToIso(time),
        source: 'google-meet-chat',
      };
      store.upsertEntry(entry);
    }
  }

  /** Extrai remetente e horário do grupo da mensagem (header com nome + "HH:MM"). */
  private parseSender(msg: Element): { name: string; time: string | null } {
    const group = msg.closest(SELECTORS.group) ?? msg.parentElement ?? msg;

    // Texto do header = texto do grupo que NÃO está dentro de uma mensagem.
    let header = '';
    const walker = document.createTreeWalker(group, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('[data-message-id]')) return NodeFilter.FILTER_REJECT; // pula o texto das mensagens
        if (p.tagName === 'I' || p.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
        if (p.closest('button,[role="button"]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n = walker.nextNode();
    while (n) {
      header += ' ' + (n.textContent ?? '');
      n = walker.nextNode();
    }
    header = header.replace(/\s+/g, ' ').trim();

    const timeMatch = header.match(TIME_RE);
    const time = timeMatch ? timeMatch[0] : null;
    let name = header;
    if (time) name = name.replace(time, '').trim();
    if (!name) name = 'Você'; // mensagens próprias normalmente não mostram o nome
    return { name, time };
  }
}
