// Popup da toolbar (RF — ação do ícone do Chrome). Comportamento condicional:
//  • aba do Google Meet  → mostra o estado da captura + atalho para abrir o painel in-page;
//  • qualquer outra aba  → orienta o usuário e oferece "Ir para o Google Meet".
// O popup vive em seu próprio contexto (sem o store da página): conversa com o content script
// via chrome.tabs.sendMessage para ler o status e alternar o painel.

import { MS_MARK_URL } from '@/ui/logo';
import { icons } from '@/ui/icons';
import { loadHistory, loadMeeting, loadSettings, requestOpenHistory, updateMeetingSummary, type HistoryMeta } from '@/services/storage-service';
import { buildTxt, buildFilename, buildHeader, buildSummaryTxt, buildMeetingJson, summarySectionBlock, downloadText, isGenericTitle } from '@/services/export-txt';
import { correctTranscript, summarizeMeeting, suggestMeetingTitle } from '@/services/summary-service';
import type { UserSettings } from '@/types';
import { t, bcp47, setLocale, resolveLocale } from '@/i18n';

const PRIVACY_URL = 'https://daraujo85.github.io/meetsync/privacy.html';
const MEET_URL = 'https://meet.google.com/';
const TEAMS_URL = 'https://teams.microsoft.com/';
const WELCOME_PATH = 'src/welcome/welcome.html';

// Hosts onde o MeetSync roda (Google Meet + Microsoft Teams Web). Usado tanto para detectar a
// aba ativa quanto para achar uma aba de reunião ao abrir o histórico.
const SUPPORTED_TAB_GLOBS = [
  'https://meet.google.com/*',
  'https://teams.cloud.microsoft/*',
  'https://teams.microsoft.com/*',
];
function isSupportedMeetingUrl(url?: string): boolean {
  return (
    !!url &&
    (url.includes('meet.google.com') ||
      url.includes('teams.cloud.microsoft') ||
      url.includes('teams.microsoft.com'))
  );
}

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
  const priv = el('a', { href: PRIVACY_URL, target: '_blank', rel: 'noopener noreferrer', text: t().popup.privacy });
  const about = el('a', { href: '#', text: t().popup.about });
  about.addEventListener('click', (e) => {
    e.preventDefault();
    void openAboutPanel();
  });
  const help = el('a', { href: '#', text: t().popup.help });
  help.addEventListener('click', (e) => {
    e.preventDefault();
    void chrome.tabs.create({ url: chrome.runtime.getURL(WELCOME_PATH) });
    window.close();
  });
  return el('div', { class: 'ms-pop-foot' }, [
    priv,
    el('span', { class: 'ms-foot-sep', text: '·' }),
    about,
    el('span', { class: 'ms-foot-sep', text: '·' }),
    help,
    el('span', { class: 'ms-foot-ver', text: `v${version}` }),
  ]);
}

/** Abre o "Sobre" na aba de reunião ativa (ou na mais recente encontrada); sem nenhuma aba
 *  suportada aberta, cai para a página de boas-vindas (conteúdo equivalente). */
async function openAboutPanel() {
  if (activeIsSupported && activeTabId !== undefined) {
    const tabId = activeTabId;
    chrome.tabs.sendMessage(tabId, { type: 'meetsync:open-about' }, () => {
      if (chrome.runtime.lastError) void chrome.tabs.create({ url: chrome.runtime.getURL(WELCOME_PATH) });
      window.close();
    });
    return;
  }
  try {
    const tabs = await chrome.tabs.query({ url: SUPPORTED_TAB_GLOBS });
    const tab = tabs.find((t) => t.id !== undefined);
    if (tab?.id !== undefined) {
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
      chrome.tabs.sendMessage(tab.id, { type: 'meetsync:open-about' }, () => void chrome.runtime.lastError);
    } else {
      await chrome.tabs.create({ url: chrome.runtime.getURL(WELCOME_PATH) });
    }
  } catch {
    void chrome.tabs.create({ url: chrome.runtime.getURL(WELCOME_PATH) });
  }
  window.close();
}

let history: HistoryMeta[] = [];
let settings: UserSettings | null = null;
let activeTabId: number | undefined;
let activeIsSupported = false;

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
  btn.textContent = t().popup.processingOllama;
  try {
    let corrected = false;
    let correctedText = '';
    let summaryText = saved.summaryText;
    if (s.enableAiCorrection) {
      try { correctedText = await correctTranscript(session, s.ollamaUrl, s.ollamaModel!, s.vocabulary); corrected = true; } catch { /* mantém bruto */ }
    }
    if (s.includeSummary && !summaryText) {
      try {
        summaryText = await summarizeMeeting(session, s.ollamaUrl, s.ollamaModel!, s.vocabulary);
        // Persiste a ata gerada agora de volta no histórico — sem isso ele continuava
        // marcando "Sem ata" mesmo depois de já ter baixado o arquivo com a ata.
        await updateMeetingSummary(session.id, summaryText);
      } catch { /* sem ata */ }
    }
    // Sem título descritivo (é o padrão da plataforma)? Sugere um via IA — só para o arquivo
    // exportado; nunca sobrescreve o título salvo no histórico.
    let exportSession = session;
    if (isGenericTitle(session)) {
      try {
        const suggested = await suggestMeetingTitle(session, s.ollamaUrl, s.ollamaModel!, s.vocabulary);
        if (suggested) exportSession = { ...session, meetingTitle: suggested };
      } catch {
        /* mantém o título original */
      }
    }
    const inlineSummary = !!summaryText && !s.separateSummaryFile;
    const main = corrected
      ? (s.includeHeaderByDefault ? buildHeader(exportSession) : '') + correctedText + (inlineSummary ? summarySectionBlock(summaryText!) : '')
      : buildTxt(exportSession, { includeHeader: s.includeHeaderByDefault, summaryText: inlineSummary ? summaryText : undefined });
    const gap = () => new Promise<void>((r) => setTimeout(r, 500));
    downloadText(buildFilename(session), main);
    if (summaryText && s.separateSummaryFile) { await gap(); downloadText(buildFilename(session, '_resumo'), buildSummaryTxt(exportSession, summaryText)); }
    if (s.exportJson) { await gap(); downloadText(buildFilename(session, '', 'json'), buildMeetingJson(exportSession, summaryText)); }
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
    return new Date(iso).toLocaleString(bcp47(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Abre o painel de histórico — funciona igual dentro ou fora do meet.google.com. */
async function openHistoryPanel() {
  if (activeIsSupported && activeTabId !== undefined) {
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
    const tabs = await chrome.tabs.query({ url: SUPPORTED_TAB_GLOBS });
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
  const p = t().popup;
  const actions: Node[] = [];

  // Download principal (labeled). Com IA configurada, baixa com correção/resumo.
  const primary = el('button', { class: 'ms-btn ms-btn-primary ms-btn-sm ms-rec-dl', type: 'button', title: ai ? p.dlWithAiTitle : p.dlTxtTitle }, [
    el('span', { class: 'ms-rec-dl-ico', html: icons.download }),
    el('span', { text: ai ? p.dlWithAi : p.dlTxt }),
  ]) as HTMLButtonElement;
  primary.addEventListener('click', () => (ai ? void downloadWithAi(last, primary) : downloadRaw()));
  actions.push(primary);

  // Sem IA (só-ícone) quando a IA está ligada.
  if (ai) actions.push(iconBtn(icons.doc, p.dlWithoutAiTitle, downloadRaw));

  // Abrir histórico (só-ícone) — sempre disponível, dentro ou fora do Meet.
  actions.push(iconBtn(icons.history, p.openHistoryTitle(history.length), () => void openHistoryPanel()));

  return el('div', { class: 'ms-pop-recovery' }, [
    el('div', { class: 'ms-rec-title', text: p.lastMeeting }),
    el('div', { class: 'ms-rec-sub', text: p.recSub(last.title, last.lines, formatWhen(last.savedAt)) }),
    el('div', { class: 'ms-rec-actions' }, actions),
  ]);
}

/** Estado fora do Google Meet: orienta e oferece atalho para entrar numa reunião. */
function renderOutsideMeet() {
  const p = t().popup;
  const open = (url: string) => () => {
    void chrome.tabs.create({ url });
    window.close();
  };
  const meetBtn = el('button', { class: 'ms-btn ms-btn-primary', type: 'button', text: p.goToMeet });
  meetBtn.addEventListener('click', open(MEET_URL));
  const teamsBtn = el('button', { class: 'ms-btn ms-btn-secondary', type: 'button', text: p.goToTeams });
  teamsBtn.addEventListener('click', open(TEAMS_URL));
  render(
    el('div', { class: 'ms-pop-body' }, [
      el('p', { class: 'ms-pop-msg', html: p.outsideMsg1Html }),
      el('p', { class: 'ms-pop-msg', text: p.outsideMsg2 }),
      el('div', { class: 'ms-pop-gorow' }, [meetBtn, teamsBtn]),
    ]),
    recoveryCard(),
  );
}

/** Estado dentro do Meet, mas sem reunião ativa (lobby/início). */
function renderMeetIdle() {
  const p = t().popup;
  render(
    el('div', { class: 'ms-pop-body' }, [
      el('p', { class: 'ms-pop-msg', html: p.idleMsg1Html }),
      el('p', { class: 'ms-pop-msg', text: p.idleMsg2 }),
    ]),
    recoveryCard(),
  );
}

function statusUi(): Record<StatusReply['captureStatus'], { dot: string; label: string }> {
  const p = t().popup;
  return {
    idle: { dot: '', label: p.statusIdle },
    waiting: { dot: 'is-clay', label: p.waitingCaptions },
    capturing: { dot: 'is-rec', label: p.captureActive },
    processing: { dot: 'is-clay', label: p.processingAi },
    error: { dot: 'is-clay', label: p.errorAi },
  };
}

/** Estado em reunião (ou pós-reunião): status + atalho para abrir o painel. */
function renderInMeeting(s: StatusReply, tabId: number) {
  const p = t().popup;
  const sub = s.ended ? p.meetingEndedSub(s.entries) : p.inMeetingSub(s.entries, s.participants);
  const ui = s.ended ? { dot: 'is-clay', label: p.meetingEnded } : statusUi()[s.captureStatus];

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
    text: s.expanded ? p.collapsePanel : p.openPanel,
  });
  openBtn.addEventListener('click', () => {
    chrome.tabs.sendMessage(tabId, { type: 'meetsync:toggle-panel' }, () => void chrome.runtime.lastError);
    window.close();
  });

  render(el('div', { class: 'ms-pop-body' }, [status, openBtn]));
}

async function init() {
  [history, settings] = await Promise.all([loadHistory(), loadSettings()]);
  setLocale(resolveLocale(settings.locale));
  document.documentElement.lang = bcp47();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // tab.url só é legível para hosts com permissão (Meet + Teams): basta para identificar
  // positivamente uma aba de reunião suportada — qualquer outra cai no estado de orientação.
  const supported = isSupportedMeetingUrl(tab?.url);
  activeTabId = tab?.id;
  activeIsSupported = supported && tab?.id !== undefined;

  if (!supported || tab?.id === undefined) {
    renderOutsideMeet();
    return;
  }

  // Em aba suportada: pergunta o status ao content script. Se não responder (ainda carregando
  // ou fora de reunião), mostra o estado "na aba, sem reunião".
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
