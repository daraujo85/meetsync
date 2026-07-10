// Service worker (MV3) — enxuto. Executa as chamadas HTTP ao Ollama em nome do content
// script (CORS/host permissions) e responde via mensagens.

import {
  handleOllamaAction,
  streamGenerate,
  STREAM_PORT,
  type OllamaAction,
  type StreamRequest,
} from '@/services/ollama-client';
import { loadSettings } from '@/services/storage-service';
import { t, setLocale, resolveLocale } from '@/i18n';

/** Resolve o idioma a partir das settings salvas (o worker não tem o store em memória). */
async function ensureLocale(): Promise<void> {
  const settings = await loadSettings();
  setLocale(resolveLocale(settings.locale));
}

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
type NotifyMessage = { type: 'meetsync:notify'; kind: 'start' | 'end' | 'hint'; code?: string; entries?: number; title?: string; text?: string };

chrome.runtime.onMessage.addListener((message: NotifyMessage) => {
  if (!message || message.type !== 'meetsync:notify') return undefined;
  const iconUrl = chrome.runtime.getURL('public/icons/icon-128.png');
  void (async () => {
    await ensureLocale();
    const n = t().notify;
    if (message.kind === 'start') {
      void chrome.notifications.create({
        type: 'basic',
        iconUrl,
        title: n.captureStartedTitle,
        message: message.code ? n.capturingCode(message.code) : n.capturingMeeting,
        priority: 0,
      });
    } else if (message.kind === 'end') {
      void chrome.notifications.create({
        type: 'basic',
        iconUrl,
        title: n.meetingEndedTitle,
        message: n.transcriptReady(message.entries ?? 0),
        priority: 0,
      });
    } else if (message.kind === 'hint' && message.text) {
      void chrome.notifications.create({
        type: 'basic',
        iconUrl,
        title: message.title || 'MeetSync',
        message: message.text,
        priority: 0,
      });
    }
  })();
  return undefined;
});

// Alertas de menção: notificação clicável (foca a aba do Meet) + badge no ícone.
type AlertMessage = { type: 'meetsync:alert'; title: string; message: string; notify?: boolean; badge?: boolean };

// notificationId -> aba que originou o alerta (para focar ao clicar).
const alertTabByNotif = new Map<string, { tabId: number; windowId?: number }>();
// tabId -> alertas pendentes (contador do badge).
const badgeByTab = new Map<number, number>();
let alertSeq = 0;

chrome.runtime.onMessage.addListener((message: AlertMessage, sender) => {
  if (!message || message.type !== 'meetsync:alert') return undefined;
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;

  if (message.notify) {
    const notifId = `meetsync-alert-${++alertSeq}`;
    chrome.notifications.create(notifId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('public/icons/icon-128.png'),
      title: message.title,
      message: message.message,
      priority: 2,
      requireInteraction: true,
    });
    if (typeof tabId === 'number') alertTabByNotif.set(notifId, { tabId, windowId });
  }

  if (message.badge && typeof tabId === 'number') {
    const count = (badgeByTab.get(tabId) ?? 0) + 1;
    badgeByTab.set(tabId, count);
    void chrome.action.setBadgeBackgroundColor({ color: '#EA4335' });
    void chrome.action.setBadgeText({ tabId, text: String(count) });
  }
  return undefined;
});

// Clique na notificação → traz a aba do Meet para frente e limpa o alerta.
chrome.notifications.onClicked.addListener((notifId) => {
  const target = alertTabByNotif.get(notifId);
  if (!target) return;
  void chrome.tabs.update(target.tabId, { active: true });
  if (typeof target.windowId === 'number') void chrome.windows.update(target.windowId, { focused: true });
  void chrome.notifications.clear(notifId);
  alertTabByNotif.delete(notifId);
  clearBadge(target.tabId);
});

// Ao voltar para a aba do Meet, zera o badge de alertas pendentes.
chrome.tabs.onActivated.addListener(({ tabId }) => clearBadge(tabId));

function clearBadge(tabId: number) {
  if (!badgeByTab.has(tabId)) return;
  badgeByTab.delete(tabId);
  void chrome.action.setBadgeText({ tabId, text: '' });
}

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
