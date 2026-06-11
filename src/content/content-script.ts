// Bootstrap do content script: monta host + Shadow DOM, inicializa estado, conecta
// detector de reunião, captura de legendas e UI.

import tokensCss from '@/ui/styles/tokens.css?inline';
import meetsyncCss from '@/ui/styles/meetsync.css?inline';
import { store } from '@/services/store';
import { Panel } from '@/ui/panel';
import { MeetDetector, type MeetingMeta } from './meet-detector';
import { CaptionCapture } from './caption-capture';
import { ChatCapture } from './chat-capture';

const HOST_ID = 'meetsync-host';

function mountUi(): Panel {
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

  const capture = new CaptionCapture();
  const chat = new ChatCapture();
  const panel = new Panel({
    toggleCaptions: () => capture.toggleCaptions(),
  });
  panel.mount(shadow);

  // Guarda host e capturas na instância para o detector/guard acessarem.
  const handle = panel as unknown as { __capture: CaptionCapture; __chat: ChatCapture; __host: HTMLElement };
  handle.__capture = capture;
  handle.__chat = chat;
  handle.__host = host;
  return panel;
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

    return undefined;
  });

  // Notifica início/fim da captura (uma vez por transição).
  let lastInMeeting = false;
  let lastEnded = false;
  store.subscribe((s) => {
    if (s.inMeeting && !lastInMeeting) {
      chrome.runtime.sendMessage(
        { type: 'meetsync:notify', kind: 'start', code: s.session.meetingCode },
        () => void chrome.runtime.lastError,
      );
    }
    if (s.ended && !lastEnded) {
      chrome.runtime.sendMessage(
        { type: 'meetsync:notify', kind: 'end', entries: s.session.transcript.length },
        () => void chrome.runtime.lastError,
      );
    }
    lastInMeeting = s.inMeeting;
    lastEnded = s.ended;
  });
}

/** Re-injeta o host se o Meet remover o nó do DOM (re-render de layout). Mantém estado/painel. */
function keepHostAttached(host: HTMLElement) {
  window.setInterval(() => {
    if (!document.contains(host)) {
      (document.body ?? document.documentElement).append(host);
    }
  }, 2000);
}

async function main() {
  await store.initSettings();
  const panel = mountUi();
  const handle = panel as unknown as { __capture: CaptionCapture; __chat: ChatCapture; __host: HTMLElement };
  const capture = handle.__capture;
  const chat = handle.__chat;
  keepHostAttached(handle.__host);
  wireToolbarBridge();

  const detector = new MeetDetector({
    onJoined: (meta: MeetingMeta) => {
      store.startSession(meta);
      store.setCaptureStatus('waiting');
      try {
        capture.start();
        chat.start(); // captura mensagens do chat de texto (quando o painel estiver aberto)
      } catch (err) {
        console.warn('[MeetSync] falha ao iniciar captura', err);
      }
      if (store.get().settings.autoEnableCaptions) {
        // Pequeno atraso para a toolbar do Meet renderizar antes de tentar ligar legendas.
        window.setTimeout(() => {
          try {
            capture.tryEnableCaptions();
          } catch {
            /* ignora */
          }
        }, 1500);
      }
    },
    onLeft: () => {
      store.setCaptureEndedAt(new Date().toISOString());
      try {
        capture.stop();
        chat.stop();
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
