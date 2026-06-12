// Captura das legendas do Google Meet — MÓDULO ISOLADO e de maior risco (§14, RNF-022).
//
// >>> AJUSTE AQUI quando o DOM do Meet mudar <<<
// Todos os seletores e heurísticas ficam concentrados neste arquivo para facilitar manutenção.
//
// Estratégia (sem depender de classes ofuscadas):
//  1. Localizar o container de legendas pelo aria-label ("Legendas"/"Captions").
//  2. Observar mutações nesse container (subtree + characterData), com debounce.
//  3. Para cada "linha de fala" visível, extrair (nome, texto) por heurística de leaves.
//  4. Mapear cada nó-linha do DOM -> entrada da transcrição (WeakMap). O Meet reescreve
//     a mesma linha enquanto a fala é refinada: atualizamos a entrada in-place (dedup natural).
//     Quando o texto encolhe muito / o nome muda no mesmo nó, tratamos como nova fala.

import { store, cryptoRandomId } from '@/services/store';
import type { TranscriptEntry } from '@/types';
import { avatarFromCaptionRow, resolveSelfName } from './participant-resolver';

// Seletores confirmados ao vivo (Meet PT-BR, jun/2026). O `jsname`/`jscontroller` são os
// mais estáveis; as classes ofuscadas (a4cQT etc.) ficam como último fallback.
const SELECTORS = {
  // Botão que liga/desliga legendas (toolbar inferior). jsname="RrG0hf" é específico do toggle
  // (evita casar com "Tipo de legenda", que é um combobox).
  captionsButton: [
    'button[jsname="RrG0hf"]',
    'button[aria-label*="Ativar legenda" i]',
    'button[aria-label*="Desativar legenda" i]',
    'button[aria-label*="turn on captions" i]',
    'button[aria-label*="turn off captions" i]',
  ],
  // Região onde o texto das legendas é exibido (só existe quando as legendas estão ligadas).
  captionContainer: [
    'div[role="region"][aria-label*="Legenda" i]',
    'div[role="region"][aria-label*="Caption" i]',
    'div[jscontroller="KPn5nb"]',
    '.a4cQT', // fallback frágil
  ],
};

const DEBOUNCE_MS = 300; // RNF-007
const MIN_TEXT_LEN = 1;

type OpenEntry = { id: string; name: string; text: string; capturedAt: string };

/**
 * Texto "limpo" de um nó de legenda: ignora ícones (Material Symbols em <i>), elementos
 * decorativos (aria-hidden) e qualquer coisa dentro de botões/controles. Evita que ligaduras
 * de ícone (ex.: "arrow_downward") e rótulos de botões vazem para a transcrição.
 */
function cleanCaptionText(root: Element): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.tagName === 'I') return NodeFilter.FILTER_REJECT; // ícone
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

/** Normaliza para comparação: minúsculas, sem pontuação, espaços colapsados. */
function normU(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:…"']+/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Duas falas são "a mesma" (o Meet finaliza a legenda em blocos cumulativos do mesmo falante)
 * se forem iguais, uma for prefixo da outra, OU compartilharem um prefixo comum longo —
 * tolerante a mudanças de pontuação no fim ("espaço." vs "espaço oposto").
 */
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

function queryAny(selectors: string[]): Element | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch {
      /* seletor inválido em algum navegador — ignora */
    }
  }
  return null;
}

/** O botão de legendas está marcado como ativo? */
function isCaptionsButtonOn(btn: Element | null): boolean {
  if (!btn) return false;
  const pressed = btn.getAttribute('aria-pressed');
  if (pressed != null) return pressed === 'true';
  return false;
}

export class CaptionCapture {
  private observer: MutationObserver | null = null;
  private debounceId: number | null = null;
  private stateTimer: number | null = null;
  private container: Element | null = null;
  private rowToEntry = new WeakMap<Element, OpenEntry>();
  private running = false;

  start() {
    if (this.running) return;
    this.running = true;
    // Verifica periodicamente o estado das legendas (ligadas/desligadas) e (re)liga o observer.
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

  /** Tenta ligar as legendas do Meet automaticamente (RF-036). Não desliga se já estiverem on. */
  tryEnableCaptions(): boolean {
    if (queryAny(SELECTORS.captionContainer) != null) return true; // já ligadas
    const btn = queryAny(SELECTORS.captionsButton) as HTMLElement | null;
    if (btn) {
      btn.click();
      return true;
    }
    // Fallback: atalho de teclado "c" do Meet.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    return false;
  }

  /** Alterna manualmente as legendas (botão CC do MeetSync — RF-020). */
  toggleCaptions() {
    const btn = queryAny(SELECTORS.captionsButton) as HTMLElement | null;
    if (btn) {
      btn.click();
    } else {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    }
    // Reavalia logo após o clique.
    window.setTimeout(() => this.syncCaptionState(), 400);
  }

  /** Detecta se legendas estão ativas e liga/desliga a captura conforme (RF-039/040). */
  private syncCaptionState() {
    const btn = queryAny(SELECTORS.captionsButton);
    const container = queryAny(SELECTORS.captionContainer);
    const on = isCaptionsButtonOn(btn) || container != null;

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
      this.harvest(); // leitura inicial
    } else {
      this.detachObserver();
      this.container = null;
      // Fecha falas abertas ao desligar legendas (mantém continuidade ao religar — RF-041).
      this.rowToEntry = new WeakMap();
      if (store.get().inMeeting && store.get().captureStatus !== 'processing') {
        store.setCaptureStatus('waiting');
      }
    }
  }

  private attachObserver(container: Element) {
    this.observer = new MutationObserver(() => this.scheduleHarvest());
    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
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

  /** Lê as linhas de legenda atualmente visíveis e atualiza a transcrição. */
  private harvest() {
    if (!this.container) return;
    const rows = this.findRows(this.container);
    for (const row of rows) {
      const parsed = this.parseRow(row);
      if (!parsed || parsed.text.length < MIN_TEXT_LEN) continue;

      // "Você" → nome configurado (resolvido aqui para manter dedup e downstream consistentes).
      parsed.name = resolveSelfName(parsed.name, store.get().settings.selfName);
      const name = parsed.name || 'Participante';
      let open = this.rowToEntry.get(row);
      const isNewUtterance =
        !open ||
        open.name !== parsed.name ||
        // texto encolheu de forma relevante => o nó foi reciclado para outra fala
        parsed.text.length + 8 < open.text.length;

      if (isNewUtterance) {
        // Antes de criar uma entrada nova, deduplica contra a última fala do mesmo participante
        // (Meet às vezes recria o bloco com o mesmo texto → evita linha duplicada).
        const transcript = store.get().session.transcript;
        const last = transcript[transcript.length - 1];
        if (last && last.participantName === name && sameUtterance(last.text, parsed.text)) {
          // continuação/duplicata → mantém id E horário original da fala
          open = { id: last.id, name, text: longer(last.text, parsed.text), capturedAt: last.capturedAt };
        } else {
          open = { id: cryptoRandomId(), name, text: parsed.text, capturedAt: new Date().toISOString() };
        }
        this.rowToEntry.set(row, open);
      } else {
        // atualização in-place da MESMA fala: preserva o horário de início (não vira "agora")
        open!.name = parsed.name;
        open!.text = parsed.text;
      }

      const entry: TranscriptEntry = {
        id: open!.id,
        participantName: name,
        participantAvatarUrl: parsed.avatarUrl,
        text: open!.text,
        capturedAt: open!.capturedAt,
        source: 'google-meet-caption',
      };
      store.upsertEntry(entry);
    }
  }

  /**
   * Identifica as "linhas de fala" por ESTRUTURA, não por classe (classes do Meet são ofuscadas).
   * Cada fala é um filho direto da região de legendas que contém um avatar (<img>).
   * Botões/controles do Meet (ex.: "ir para o fim") NÃO têm avatar, então são ignorados.
   */
  private findRows(container: Element): Element[] {
    const imgs = Array.from(container.querySelectorAll('img'));
    const rows = new Set<Element>();

    for (const img of imgs) {
      // Ignora imagens dentro de botões/controles.
      if (img.closest('button,[role="button"]')) continue;
      let row: Element = img;
      while (row.parentElement && row.parentElement !== container) {
        row = row.parentElement;
      }
      if (row !== container && cleanCaptionText(row).length > 0) rows.add(row);
    }
    return Array.from(rows);
  }

  /**
   * Extrai nome e fala de um bloco. Estrutura observada: o sub-bloco que contém o avatar
   * também contém o NOME; a fala é o restante do texto do bloco. Sem depender de classes.
   * Usa cleanCaptionText() para nunca incluir texto de ícones/botões (ex.: "arrow_downward").
   */
  private parseRow(row: Element): { name: string; text: string; avatarUrl?: string } | null {
    const full = cleanCaptionText(row);
    if (!full) return null;

    let name = '';
    const img = row.querySelector('img');
    if (img) {
      // Sobe do avatar até o sub-bloco com texto (avatar + nome). Esse texto é o nome.
      let nb: Element | null = img.parentElement;
      while (nb && nb !== row && cleanCaptionText(nb).length === 0) {
        nb = nb.parentElement;
      }
      if (nb && nb !== row) name = cleanCaptionText(nb);
    }

    let text = full;
    if (name && full.startsWith(name)) text = full.slice(name.length).trim();
    else if (name) text = full.replace(name, '').trim();

    if (!text) return null; // só o nome, fala ainda não começou
    return { name, text, avatarUrl: avatarFromCaptionRow(row) };
  }
}
