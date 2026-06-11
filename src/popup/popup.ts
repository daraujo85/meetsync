// Popup da toolbar (RF — ação do ícone do Chrome). Comportamento condicional:
//  • aba do Google Meet  → mostra o estado da captura + atalho para abrir o painel in-page;
//  • qualquer outra aba  → orienta o usuário e oferece "Ir para o Google Meet".
// O popup vive em seu próprio contexto (sem o store da página): conversa com o content script
// via chrome.tabs.sendMessage para ler o status e alternar o painel.

import { MS_MARK_URL } from '@/ui/logo';

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

function render(body: HTMLElement) {
  root.replaceChildren(header(), body, footer());
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
  );
}

/** Estado dentro do Meet, mas sem reunião ativa (lobby/início). */
function renderMeetIdle() {
  render(
    el('div', { class: 'ms-pop-body' }, [
      el('p', { class: 'ms-pop-msg', html: 'Você está no <strong>Google Meet</strong>.' }),
      el('p', { class: 'ms-pop-msg', text: 'Entre numa reunião e a captura das legendas começa automaticamente.' }),
    ]),
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // tab.url só é legível para hosts com permissão (temos meet.google.com): basta para
  // identificar positivamente o Meet — qualquer outra aba cai no estado de orientação.
  const isMeet = !!tab?.url && tab.url.includes('meet.google.com');

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
