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
