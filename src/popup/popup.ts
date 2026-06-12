// Popup da toolbar (RF — ação do ícone do Chrome). Comportamento condicional:
//  • aba do Google Meet  → mostra o estado da captura + atalho para abrir o painel in-page;
//  • qualquer outra aba  → orienta o usuário e oferece "Ir para o Google Meet".
// O popup vive em seu próprio contexto (sem o store da página): conversa com o content script
// via chrome.tabs.sendMessage para ler o status e alternar o painel.

import { MS_MARK_URL } from '@/ui/logo';
import { icons } from '@/ui/icons';
import { loadHistory, loadMeeting, loadSettings, requestOpenHistory, type HistoryMeta } from '@/services/storage-service';
import { buildTxt, buildFilename, buildHeader, buildSummaryTxt, buildMeetingJson, downloadText } from '@/services/export-txt';
import { correctTranscript, summarizeMeeting } from '@/services/summary-service';
import type { UserSettings } from '@/types';

const PRIVACY_URL = 'https://daraujo85.github.io/meetsync/privacy.html';
const MEET_URL = 'https://meet.google.com/';
const WELCOME_PATH = 'src/welcome/welcome.html';

type StatusReply = {
  inMeeting: boolean;
  ended: boolean;
  captureStatus: 'idle' | 'waiting' | 'capturing' | 'processing' | 'error';
  captionsOn: boolean;
  expanded: boolean;
  entries: number;
  participants: number;
  meetingCode: string;
};

// ---- mini-helper de DOM (sem framework, igual ao resto do projeto) ----
type Attrs = Record<string, string>;
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

const root = document.getElementById('root')!;

function header(): HTMLElement {
  const img = el('img', {});
  (img as HTMLImageElement).src = MS_MARK_URL;
  (img as HTMLImageElement).width = 26;
  (img as HTMLImageElement).height = 26;
  return el('div', { class: 'ms-pop-head' }, [img, el('span', { class: 'ms-pop-wordmark', text: 'MeetSync' })]);
}

function footer(): HTMLElement {
  const version = chrome.runtime.getManifest().version;
  const priv = el('a', { href: PRIVACY_URL, target: '_blank', rel: 'noopener noreferrer', text: 'Privacidade' });
  const help = el('a', { href: '#', text: 'Ajuda' });
  help.addEventListener('click', (e) => {
    e.preventDefault();
    void chrome.tabs.create({ url: chrome.runtime.getURL(WELCOME_PATH) });
    window.close();
  });
  return el('div', { class: 'ms-pop-foot' }, [
    priv,
    el('span', { class: 'ms-foot-sep', text: '·' }),
    help,
    el('span', { class: 'ms-foot-ver', text: `v${version}` }),
  ]);
}

let history: HistoryMeta[] = [];
let settings: UserSettings | null = null;
let activeTabId: number | undefined;
let activeIsMeet = false;

function aiReady(): boolean {
  return !!settings && !!settings.ollamaModel && !!settings.ollamaUrl && (settings.enableAiCorrection || settings.includeSummary);
}

/** Baixa a transcrição aplicando correção/resumo via Ollama (espelha o fluxo do painel). */
async function downloadWithAi(meta: HistoryMeta, btn: HTMLButtonElement) {
  const s = settings;
  if (!s) return;
  const saved = await loadMeeting(meta.id);
  if (!saved) return;
  const session = saved.session;
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Processando com Ollama…';
  try {
    let corrected = false;
    let correctedText = '';
    let summaryText = saved.summaryText;
    if (s.enableAiCorrection) {
      try { correctedText = await correctTranscript(session, s.ollamaUrl, s.ollamaModel!, s.vocabulary); corrected = true; } catch { /* mantém bruto */ }
    }
    if (s.includeSummary && !summaryText) {
      try { summaryText = await summarizeMeeting(session, s.ollamaUrl, s.ollamaModel!, s.vocabulary); } catch { /* sem ata */ }
    }
    const inlineSummary = !!summaryText && !s.separateSummaryFile;
    const main = corrected
      ? (s.includeHeaderByDefault ? buildHeader(session) : '') + correctedText + (inlineSummary ? `\n\n${summaryText}` : '')
      : buildTxt(session, { includeHeader: s.includeHeaderByDefault, summaryText: inlineSummary ? summaryText : undefined });
    const gap = () => new Promise<void>((r) => setTimeout(r, 500));
    downloadText(buildFilename(session), main);
    if (summaryText && s.separateSummaryFile) { await gap(); downloadText(buildFilename(session, '_resumo'), buildSummaryTxt(session, summaryText)); }
    if (s.exportJson) { await gap(); downloadText(buildFilename(session, '', 'json'), buildMeetingJson(session, summaryText)); }
  } finally {
    btn.disabled = false;
    if (original) btn.textContent = original;
  }
}

function render(body: HTMLElement, recovery?: HTMLElement | null) {
  root.replaceChildren(header(), body, ...(recovery ? [recovery] : []), footer());
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Abre o painel de histórico — funciona igual dentro ou fora do meet.google.com. */
async function openHistoryPanel() {
  if (activeIsMeet && activeTabId !== undefined) {
    const tabId = activeTabId;
    chrome.tabs.sendMessage(tabId, { type: 'meetsync:open-history' }, () => {
      if (chrome.runtime.lastError) {
        // Content script ausente (aba aberta antes de um reload da extensão): recarrega com o
        // sinal para abrir o histórico assim que carregar. Seguro aqui — só caímos neste card
        // fora de uma reunião ativa, então recarregar não derruba ninguém de uma chamada.
        void requestOpenHistory().then(() => chrome.tabs.reload(tabId));
      }
      window.close();
    });
    return;
  }
  try {
    const tabs = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
    const meetTab = tabs.find((t) => t.id !== undefined);
    if (meetTab?.id !== undefined) {
      await chrome.tabs.update(meetTab.id, { active: true });
      if (meetTab.windowId !== undefined) await chrome.windows.update(meetTab.windowId, { focused: true });
      chrome.tabs.sendMessage(meetTab.id, { type: 'meetsync:open-history' }, () => void chrome.runtime.lastError);
    } else {
      await requestOpenHistory();
      await chrome.tabs.create({ url: MEET_URL });
    }
  } catch {
    await requestOpenHistory();
    void chrome.tabs.create({ url: MEET_URL });
  }
  window.close();
}

/** Botão só-ícone com tooltip (title). */
function iconBtn(iconHtml: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', { class: 'ms-rec-iconbtn', type: 'button', title, 'aria-label': title, html: iconHtml }) as HTMLButtonElement;
  b.addEventListener('click', onClick);
  return b;
}

/** Card do histórico: última reunião salva (baixar) + atalho para abrir o histórico completo. */
function recoveryCard(): HTMLElement | null {
  if (!history.length) return null;
  const last = history[0]!;

  const downloadRaw = () => {
    void (async () => {
      const saved = await loadMeeting(last.id);
      if (saved) downloadText(buildFilename(saved.session), buildTxt(saved.session, { includeHeader: true }));
    })();
  };

  const ai = aiReady();
  const actions: Node[] = [];

  // Download principal (labeled). Com IA configurada, baixa com correção/resumo.
  const primary = el('button', { class: 'ms-btn ms-btn-primary ms-btn-sm ms-rec-dl', type: 'button', title: ai ? 'Baixar .txt com IA (correção + resumo)' : 'Baixar transcrição (.txt)' }, [
    el('span', { class: 'ms-rec-dl-ico', html: icons.download }),
    el('span', { text: ai ? 'Baixar com IA' : 'Baixar .txt' }),
  ]) as HTMLButtonElement;
  primary.addEventListener('click', () => (ai ? void downloadWithAi(last, primary) : downloadRaw()));
  actions.push(primary);

  // Sem IA (só-ícone) quando a IA está ligada.
  if (ai) actions.push(iconBtn(icons.doc, 'Baixar .txt sem IA', downloadRaw));

  // Abrir histórico (só-ícone) — sempre disponível, dentro ou fora do Meet.
  actions.push(iconBtn(icons.history, `Abrir histórico de reuniões (${history.length})`, () => void openHistoryPanel()));

  return el('div', { class: 'ms-pop-recovery' }, [
    el('div', { class: 'ms-rec-title', text: 'Última reunião salva' }),
    el('div', { class: 'ms-rec-sub', text: `${last.title} · ${last.lines} fala(s) · ${formatWhen(last.savedAt)}` }),
    el('div', { class: 'ms-rec-actions' }, actions),
  ]);
}

/** Estado fora do Google Meet: orienta e oferece atalho para entrar numa reunião. */
function renderOutsideMeet() {
  const goBtn = el('button', { class: 'ms-btn ms-btn-primary', type: 'button', text: 'Ir para o Google Meet' });
  goBtn.addEventListener('click', () => {
    void chrome.tabs.create({ url: MEET_URL });
    window.close();
  });
  render(
    el('div', { class: 'ms-pop-body' }, [
      el('p', { class: 'ms-pop-msg', html: 'O MeetSync funciona <strong>dentro do Google Meet</strong>.' }),
      el('p', { class: 'ms-pop-msg', text: 'Entre numa reunião para capturar as legendas, ver o chat e exportar a transcrição.' }),
      goBtn,
    ]),
    recoveryCard(),
  );
}

/** Estado dentro do Meet, mas sem reunião ativa (lobby/início). */
function renderMeetIdle() {
  render(
    el('div', { class: 'ms-pop-body' }, [
      el('p', { class: 'ms-pop-msg', html: 'Você está no <strong>Google Meet</strong>.' }),
      el('p', { class: 'ms-pop-msg', text: 'Entre numa reunião e a captura das legendas começa automaticamente.' }),
    ]),
    recoveryCard(),
  );
}

const STATUS_UI: Record<StatusReply['captureStatus'], { dot: string; label: string }> = {
  idle: { dot: '', label: 'Parado' },
  waiting: { dot: 'is-clay', label: 'Aguardando legendas' },
  capturing: { dot: 'is-rec', label: 'Captura ativa' },
  processing: { dot: 'is-clay', label: 'Processando (IA)' },
  error: { dot: 'is-clay', label: 'Erro de IA' },
};

/** Estado em reunião (ou pós-reunião): status + atalho para abrir o painel. */
function renderInMeeting(s: StatusReply, tabId: number) {
  const sub = s.ended
    ? `Reunião encerrada · ${s.entries} fala(s)`
    : `${s.entries} fala(s) · ${s.participants} participante(s)`;
  const ui = s.ended ? { dot: 'is-clay', label: 'Reunião encerrada' } : STATUS_UI[s.captureStatus];

  const status = el('div', { class: 'ms-pop-status' }, [
    el('span', { class: `ms-dot ${ui.dot}`.trim() }),
    el('div', {}, [
      el('div', { class: 'ms-status-label', text: ui.label }),
      el('div', { class: 'ms-status-sub', text: sub }),
    ]),
  ]);

  const openBtn = el('button', {
    class: 'ms-btn ms-btn-primary',
    type: 'button',
    text: s.expanded ? 'Recolher painel' : 'Abrir painel',
  });
  openBtn.addEventListener('click', () => {
    chrome.tabs.sendMessage(tabId, { type: 'meetsync:toggle-panel' }, () => void chrome.runtime.lastError);
    window.close();
  });

  render(el('div', { class: 'ms-pop-body' }, [status, openBtn]));
}

async function init() {
  [history, settings] = await Promise.all([loadHistory(), loadSettings()]);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // tab.url só é legível para hosts com permissão (temos meet.google.com): basta para
  // identificar positivamente o Meet — qualquer outra aba cai no estado de orientação.
  const isMeet = !!tab?.url && tab.url.includes('meet.google.com');
  activeTabId = tab?.id;
  activeIsMeet = isMeet && tab?.id !== undefined;

  if (!isMeet || tab?.id === undefined) {
    renderOutsideMeet();
    return;
  }

  // No Meet: pergunta o status ao content script. Se não responder (ainda carregando ou fora
  // de reunião), mostra o estado "no Meet, sem reunião".
  chrome.tabs.sendMessage(tab.id, { type: 'meetsync:get-status' }, (reply?: StatusReply) => {
    if (chrome.runtime.lastError || !reply) {
      renderMeetIdle();
      return;
    }
    if (reply.inMeeting || reply.ended) renderInMeeting(reply, tab.id!);
    else renderMeetIdle();
  });
}

void init();
