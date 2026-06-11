// Service worker (MV3) — enxuto. Executa as chamadas HTTP ao Ollama em nome do content
// script (CORS/host permissions) e responde via mensagens.

import {
  handleOllamaAction,
  streamGenerate,
  STREAM_PORT,
  type OllamaAction,
  type StreamRequest,
} from '@/services/ollama-client';

// Ações simples (tags/test/generate) via mensagem única.
chrome.runtime.onMessage.addListener((message: OllamaAction, _sender, sendResponse) => {
  if (message && typeof message.type === 'string' && message.type.startsWith('ollama:')) {
    handleOllamaAction(message).then(sendResponse);
    return true; // resposta assíncrona
  }
  return undefined;
});

// Notificações de estado de captura (B): o content script avisa quando uma reunião começa
// a ser capturada e quando termina. Feedback proativo sem precisar abrir o painel.
type NotifyMessage = { type: 'meetsync:notify'; kind: 'start' | 'end'; code?: string; entries?: number };

chrome.runtime.onMessage.addListener((message: NotifyMessage) => {
  if (!message || message.type !== 'meetsync:notify') return undefined;
  const iconUrl = chrome.runtime.getURL('public/icons/icon-128.png');
  if (message.kind === 'start') {
    void chrome.notifications.create({
      type: 'basic',
      iconUrl,
      title: 'MeetSync — captura iniciada',
      message: message.code ? `Capturando as legendas de ${message.code}.` : 'Capturando as legendas da reunião.',
      priority: 0,
    });
  } else if (message.kind === 'end') {
    const n = message.entries ?? 0;
    void chrome.notifications.create({
      type: 'basic',
      iconUrl,
      title: 'MeetSync — reunião encerrada',
      message: `Transcrição pronta${n ? ` (${n} fala${n === 1 ? '' : 's'})` : ''}. Abra o painel para revisar e baixar.`,
      priority: 0,
    });
  }
  return undefined;
});

// Página de boas-vindas (C): aberta apenas na primeira instalação.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    void chrome.tabs.create({ url: chrome.runtime.getURL('src/welcome/welcome.html') });
  }
});

// Geração com streaming via Port: cada pedaço do Ollama é repassado ao content em tempo real.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== STREAM_PORT) return;
  port.onMessage.addListener((req: StreamRequest) => {
    let alive = true;
    port.onDisconnect.addListener(() => {
      alive = false;
    });
    void streamGenerate((msg) => {
      if (alive) {
        try {
          port.postMessage(msg);
        } catch {
          alive = false;
        }
      }
    }, req);
  });
});
