// Cliente Ollama. As chamadas HTTP rodam no SERVICE WORKER (background), que detém as
// host_permissions da extensão e contorna o CORS do localhost. O content script usa o
// "bridge" no fim do arquivo para falar com o background via mensagens.

// ---------- Tipos de mensagem (content <-> background) ----------
export type OllamaAction =
  | { type: 'ollama:test'; url: string }
  | { type: 'ollama:tags'; url: string }
  | { type: 'ollama:generate'; url: string; model: string; prompt: string };

export type OllamaResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ---------- Funções puras (usadas no BACKGROUND) ----------
/**
 * Normaliza a URL do Ollama: garante esquema http, remove barra final e força http
 * para localhost/127.0.0.1 (o Ollama serve HTTP puro — https:// quebraria com "Failed to fetch").
 */
export function normalizeOllamaUrl(url: string): string {
  let u = (url || '').trim();
  if (!u) return 'http://localhost:11434';
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  // Ollama local é HTTP-only: corrige https://localhost / https://127.0.0.1 → http
  u = u.replace(/^https:\/\/(localhost|127\.0\.0\.1)/i, 'http://$1');
  return u.replace(/\/+$/, '');
}

function normalizeUrl(url: string): string {
  return normalizeOllamaUrl(url);
}

async function ensureHostPermission(url: string): Promise<void> {
  // localhost/127.0.0.1 já estão em host_permissions; hosts remotos são opcionais.
  try {
    const origin = new URL(url).origin;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return;
    const pattern = `${origin}/*`;
    const has = await chrome.permissions.contains({ origins: [pattern] });
    if (!has) {
      // Best-effort: pode exigir gesto do usuário; se falhar, o fetch retornará erro claro.
      await chrome.permissions.request({ origins: [pattern] }).catch(() => false);
    }
  } catch {
    /* URL inválida tratada no fetch */
  }
}

export async function ollamaTags(url: string): Promise<string[]> {
  await ensureHostPermission(url);
  const res = await fetch(`${normalizeUrl(url)}/api/tags`); // RF-078
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { models?: Array<{ name: string }> };
  return (json.models ?? []).map((m) => m.name);
}

export async function ollamaTest(url: string): Promise<boolean> {
  await ollamaTags(url); // se listar tags, está acessível
  return true;
}

export async function ollamaGenerate(url: string, model: string, prompt: string): Promise<string> {
  await ensureHostPermission(url);
  const res = await fetch(`${normalizeUrl(url)}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { response?: string };
  return (json.response ?? '').trim();
}

// ---------- Streaming (BACKGROUND): lê /api/generate com stream e repassa via Port ----------
export const STREAM_PORT = 'ollama:stream';

export type StreamRequest = { url: string; model: string; prompt: string };
export type StreamMessage =
  | { type: 'chunk'; text: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

export async function streamGenerate(
  post: (msg: StreamMessage) => void,
  req: StreamRequest,
): Promise<void> {
  try {
    await ensureHostPermission(req.url);
    const res = await fetch(`${normalizeUrl(req.url)}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: req.model, prompt: req.prompt, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // guarda linha parcial
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const json = JSON.parse(t) as { response?: string };
          if (json.response) post({ type: 'chunk', text: json.response });
        } catch {
          /* linha não-JSON — ignora */
        }
      }
    }
    post({ type: 'done' });
  } catch (err) {
    post({ type: 'error', error: err instanceof Error ? err.message : String(err) });
  }
}

/** Roteia uma ação Ollama no background. Retorna resultado serializável. */
export async function handleOllamaAction(action: OllamaAction): Promise<OllamaResult<unknown>> {
  try {
    switch (action.type) {
      case 'ollama:test':
        return { ok: true, data: await ollamaTest(action.url) };
      case 'ollama:tags':
        return { ok: true, data: await ollamaTags(action.url) };
      case 'ollama:generate':
        return { ok: true, data: await ollamaGenerate(action.url, action.model, action.prompt) };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------- Bridge (usado no CONTENT SCRIPT) ----------
async function send<T>(action: OllamaAction): Promise<T> {
  const result = (await chrome.runtime.sendMessage(action)) as OllamaResult<T> | undefined;
  if (!result) throw new Error('Sem resposta do background.');
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/**
 * Geração com streaming (CONTENT): abre um Port com o background, recebe os pedaços e chama
 * onChunk com o texto acumulado. Resolve com o texto final. Permite "escrever enquanto recebe".
 */
function generateStream(
  url: string,
  model: string,
  prompt: string,
  onChunk: (accumulated: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: STREAM_PORT });
    let full = '';
    let settled = false;
    port.onMessage.addListener((msg: StreamMessage) => {
      if (msg.type === 'chunk') {
        full += msg.text;
        onChunk(full);
      } else if (msg.type === 'done') {
        settled = true;
        port.disconnect();
        resolve(full);
      } else if (msg.type === 'error') {
        settled = true;
        port.disconnect();
        reject(new Error(msg.error));
      }
    });
    port.onDisconnect.addListener(() => {
      if (!settled) reject(new Error('Conexão com o background encerrada.'));
    });
    port.postMessage({ url, model, prompt } satisfies StreamRequest);
  });
}

export const ollama = {
  listModels: (url: string) => send<string[]>({ type: 'ollama:tags', url }),
  test: (url: string) => send<boolean>({ type: 'ollama:test', url }),
  generate: (url: string, model: string, prompt: string) =>
    send<string>({ type: 'ollama:generate', url, model, prompt }),
  generateStream,
};
