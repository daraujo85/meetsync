// Bootstrap do content script: monta host + Shadow DOM, inicializa estado, conecta
// detector de reunião, captura de legendas e UI.

import tokensCss from '@/ui/styles/tokens.css?inline';
import meetsyncCss from '@/ui/styles/meetsync.css?inline';
import { store } from '@/services/store';
import { saveMeeting, consumeOpenHistory } from '@/services/storage-service';
import { Panel } from '@/ui/panel';
import { getPlatform } from './platform';
import type { PlatformAdapter, CaptionController, ChatController, PlatformMeetingMeta } from './platform/types';
import { AlertWatcher } from './alert-watcher';

const HOST_ID = 'meetsync-host';

/** Extensão ainda "viva"? Após um reload da extensão, o content script antigo fica órfão e
 *  qualquer chamada chrome.* lança "Extension context invalidated". Usamos isto para não estourar. */
function extAlive(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}
/** Envia mensagem ao worker de forma segura (silencia contexto invalidado). */
function safeSend(msg: unknown) {
  try {
    if (extAlive()) chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError);
  } catch {
    /* contexto invalidado — ignora */
  }
}

function mountUi(platform: PlatformAdapter): Panel {
  // Evita dupla injeção em re-execuções do content script.
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement('div');
  host.id = HOST_ID;
  // O host não deve interferir no layout do Meet.
  host.style.cssText = 'all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `${tokensCss}\n${meetsyncCss}`;
  shadow.append(style);

  (document.body ?? document.documentElement).append(host);

  const capture = platform.createCaptionCapture();
  const chat = platform.createChatCapture();
  const events = platform.createEventsCapture?.() ?? null;
  const watcher = new AlertWatcher();
  const panel = new Panel({
    toggleCaptions: () => capture.toggleCaptions(),
    simulateAlert: (d) => watcher.simulate(d),
  });
  panel.mount(shadow);
  watcher.start();

  // Guarda host e capturas na instância para o detector/guard acessarem.
  const handle = panel as unknown as {
    __capture: CaptionController;
    __chat: ChatController;
    __events: ChatController | null;
    __host: HTMLElement;
  };
  handle.__capture = capture;
  handle.__chat = chat;
  handle.__events = events;
  handle.__host = host;
  return panel;
}

/**
 * Rede de segurança: salva a transcrição em chrome.storage.local periodicamente e ao encerrar,
 * para que ela sobreviva ao redirect/fechamento da aba pelo Meet (recuperável pelo popup).
 */
function wireMeetingPersistence() {
  let dirty = false;
  let timer: number | null = null;
  let lastEnded = false;

  const flush = () => {
    timer = null;
    if (!dirty) return;
    dirty = false;
    const s = store.get();
    if (s.session.transcript.length === 0) return;
    void saveMeeting(s.session, s.ui.summaryText);
  };

  store.onEntry(() => {
    dirty = true;
    if (timer === null) timer = window.setTimeout(flush, 4000);
  });

  store.subscribe((s) => {
    // Salva imediatamente ao encerrar — janela curta antes de o Meet voltar à tela inicial.
    if (s.ended && !lastEnded && s.session.transcript.length > 0) {
      void saveMeeting(s.session, s.ui.summaryText);
    }
    lastEnded = s.ended;
  });
}

/**
 * Ponte com o popup da toolbar (ação do ícone do Chrome) e disparo das notificações de captura.
 * O popup vive em outro contexto e não enxerga o store: ele pergunta o status por mensagem e
 * pede o toggle do painel. As notificações são delegadas ao service worker (host permissions).
 */
function wireToolbarBridge() {
  chrome.runtime.onMessage.addListener((msg: { type?: string }, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return undefined;

    if (msg.type === 'meetsync:get-status') {
      const s = store.get();
      sendResponse({
        inMeeting: s.inMeeting,
        ended: s.ended,
        captureStatus: s.captureStatus,
        captionsOn: s.captionsOn,
        expanded: s.ui.expanded,
        entries: s.session.transcript.length,
        participants: s.session.participants.length,
        meetingCode: s.session.meetingCode,
      });
      return true; // resposta assíncrona
    }

    if (msg.type === 'meetsync:toggle-panel') {
      const next = !store.get().ui.expanded;
      store.patchUi({ expanded: next });
      sendResponse({ ok: true, expanded: next });
      return true;
    }

    if (msg.type === 'meetsync:open-history') {
      // Abre o histórico mesmo fora de uma reunião (modo revisão força o painel visível).
      store.patchUi({ review: true, expanded: true, historyOpen: true });
      sendResponse({ ok: true });
      return true;
    }

    return undefined;
  });

  // Notifica início/fim da captura (uma vez por transição).
  let lastInMeeting = false;
  let lastEnded = false;
  store.subscribe((s) => {
    if (s.inMeeting && !lastInMeeting) {
      safeSend({ type: 'meetsync:notify', kind: 'start', code: s.session.meetingCode });
    }
    if (s.ended && !lastEnded) {
      safeSend({ type: 'meetsync:notify', kind: 'end', entries: s.session.transcript.length });
    }
    lastInMeeting = s.inMeeting;
    lastEnded = s.ended;
  });
}

/** Re-injeta o host se o Meet remover o nó do DOM (re-render de layout). Mantém estado/painel. */
function keepHostAttached(host: HTMLElement) {
  window.setInterval(() => {
    if (!extAlive()) return; // content script órfão após reload — não faz nada
    if (!document.contains(host)) {
      (document.body ?? document.documentElement).append(host);
    }
  }, 2000);
}

let hintShown = false;

async function main() {
  const platform = getPlatform();
  if (!platform) return; // host não suportado (defesa; o manifest já restringe)
  await store.initSettings();
  const panel = mountUi(platform);
  const handle = panel as unknown as {
    __capture: CaptionController;
    __chat: ChatController;
    __events: ChatController | null;
    __host: HTMLElement;
  };
  const capture = handle.__capture;
  const chat = handle.__chat;
  const events = handle.__events;
  keepHostAttached(handle.__host);
  wireToolbarBridge();
  wireMeetingPersistence();

  // Se o popup pediu (fora da reunião) para abrir o histórico, abre agora que a aba carregou.
  void consumeOpenHistory().then((open) => {
    if (open) store.patchUi({ review: true, expanded: true, historyOpen: true });
  });

  const detector = platform.createDetector({
    onJoined: (meta: PlatformMeetingMeta) => {
      // Mesmo encontro (rejoin/transiente) → retoma sem zerar; reunião nova → começa do zero.
      // Evita perder o começo da reunião caso o detector dispare um re-join espúrio.
      const cur = store.get().session;
      if (cur.meetingCode && cur.meetingCode === meta.meetingCode) store.resumeSession();
      else store.startSession(meta);
      store.setCaptureStatus('waiting');
      try {
        capture.start();
        chat.start(); // captura mensagens do chat de texto (quando o painel estiver aberto)
        events?.start(); // participantes (roster) + mão levantada + reações (Teams)
      } catch (err) {
        console.warn('[MeetSync] falha ao iniciar captura', err);
      }
      if (store.get().settings.autoEnableCaptions) {
        // Pequeno atraso para a toolbar renderizar antes de tentar ligar legendas.
        window.setTimeout(() => {
          try {
            capture.tryEnableCaptions();
          } catch {
            /* ignora */
          }
        }, 1500);
      }
      // Dica de plataforma (ex.: conferir idioma da legenda no Teams) — uma vez por sessão da aba.
      if (platform.captionLanguageHint && !hintShown) {
        hintShown = true;
        window.setTimeout(() => {
          safeSend({ type: 'meetsync:notify', kind: 'hint', text: platform.captionLanguageHint });
        }, 2500);
      }
    },
    onLeft: () => {
      store.setCaptureEndedAt(new Date().toISOString());
      try {
        capture.stop();
        chat.stop();
        events?.stop();
      } catch {
        /* ignora */
      }
      // Mantém a transcrição visível no painel após a reunião (não zera) — o usuário lê/baixa
      // com calma. O reset só acontece ao iniciar uma nova reunião (startSession).
      store.endSession();
    },
  });
  detector.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void main());
} else {
  void main();
}
