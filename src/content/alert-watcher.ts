// Monitor de menções (aba Alertas). Observa as falas capturadas e avisa o usuário quando OUTRO
// participante diz um termo vigiado ("meu nome", uma palavra/frase) ou — via IA — fala de algo
// que interessa ao usuário (ex.: a tela que ele compartilhou). Pensado para quem está em outra
// aba/reunião: o alerta o chama de volta para a tela do Meet.
//
// O modelo é uma lista de REGRAS (`UserSettings.alertWatches`), cada uma keyword (match por texto)
// ou ai (contexto via Ollama). Quando arma ("Monitorar a reunião"), as regras habilitadas valem.
//
// Ações ao disparar: banner in-app (store.pushAlert → overlay + histórico + badge no sininho),
// notificação clicável do Chrome (foca a aba do Meet, alcança você em outra aba) e bipe opcional.

import { store } from '@/services/store';
import type { AlertDetection, TranscriptEntry, UserSettings } from '@/types';
import { ollama } from '@/services/ollama-client';

/** Normaliza para comparação tolerante: minúsculas, sem acento, espaços colapsados. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Correspondência por palavra(s) inteira(s) — evita casar "ana" dentro de "banana". */
function termMatches(termNorm: string, textNorm: string): boolean {
  if (!termNorm) return false;
  const esc = termNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}([^\\p{L}\\p{N}]|$)`, 'u').test(textNorm);
  } catch {
    return textNorm.includes(termNorm);
  }
}

function hhmm(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

const GLOBAL_COOLDOWN_MS = 4000; // evita rajada de alertas
const AI_INTERVAL_MS = 15000; // cadência mínima da avaliação por IA
const AI_CONTEXT_LINES = 12; // janela de falas enviadas à IA
const SNIPPET_MAX = 160;

export class AlertWatcher {
  private unsubEntry: (() => void) | null = null;
  private aiTimer: number | null = null;

  private sessionId = '';
  /** termos já disparados por entrada (cada fala alerta um termo só uma vez, mesmo crescendo). */
  private firedByEntry = new Map<string, Set<string>>();
  private aiSeenCount = 0;
  private aiBusy = false;
  private lastFireAt = 0;
  private keySeq = 0;

  private audioCtx: AudioContext | null = null;

  start() {
    this.unsubEntry = store.onEntry((entry) => this.onEntry(entry));
    this.aiTimer = window.setInterval(() => void this.tickAi(), AI_INTERVAL_MS);
  }

  stop() {
    this.unsubEntry?.();
    if (this.aiTimer !== null) clearInterval(this.aiTimer);
    this.aiTimer = null;
  }

  private resetIfNewSession() {
    const id = store.get().session.id;
    if (id !== this.sessionId) {
      this.sessionId = id;
      this.firedByEntry.clear();
      this.aiSeenCount = 0;
    }
  }

  /** A fala é do próprio usuário? (não autoalerta) */
  private isSelf(name: string, s: UserSettings): boolean {
    const n = normalize(name);
    if (!n) return false;
    if (/^(voce|you)$/.test(n)) return true; // o Meet às vezes rotula a própria fala
    const self = normalize(s.selfName);
    return !!self && n === self;
  }

  // ================= Detecção por texto (keyword) =================
  private onEntry(entry: TranscriptEntry) {
    const s = store.get().settings;
    if (!s.alertsArmed || !store.get().inMeeting) return;
    if (this.isSelf(entry.participantName, s)) return;

    this.resetIfNewSession();

    const watches = s.alertWatches.filter((w) => w.enabled && w.mode === 'keyword');
    if (!watches.length) return;

    const textNorm = normalize(entry.text);
    let fired = this.firedByEntry.get(entry.id);

    for (const w of watches) {
      for (const term of w.terms ?? []) {
        const termNorm = normalize(term);
        if (!termNorm || fired?.has(termNorm)) continue;
        if (!termMatches(termNorm, textNorm)) continue;
        if (!fired) {
          fired = new Set();
          this.firedByEntry.set(entry.id, fired);
        }
        fired.add(termNorm);
        this.fire({
          key: `k-${++this.keySeq}`,
          mode: 'keyword',
          label: w.label,
          reason: `Mencionaram "${term}"`,
          who: entry.participantName,
          text: snippet(entry.text),
          t: hhmm(entry.capturedAt),
        });
        return; // um alerta por fala já basta
      }
    }
  }

  // ================= Detecção por contexto (IA) =================
  private async tickAi() {
    if (this.aiBusy) return;
    const st = store.get();
    const s = st.settings;
    if (!s.alertsArmed || !st.inMeeting) return;
    if (!st.ollama.reachable || !s.ollamaModel) return;

    const aiWatches = s.alertWatches.filter((w) => w.enabled && w.mode === 'ai' && (w.desc ?? '').trim());
    if (!aiWatches.length) return;

    this.resetIfNewSession();

    const others = st.session.transcript.filter((e) => !this.isSelf(e.participantName, s));
    if (others.length <= this.aiSeenCount) return;

    const context = others.slice(Math.max(0, others.length - AI_CONTEXT_LINES));
    this.aiSeenCount = others.length;

    const lines = context.map((e) => `${e.participantName}: ${e.text}`).join('\n');
    const interests = aiWatches.map((w, i) => `${i + 1}. ${w.label}: ${w.desc}`).join('\n');
    const prompt = buildAiPrompt(interests, lines);

    this.aiBusy = true;
    try {
      const raw = await ollama.generate(s.ollamaUrl, s.ollamaModel, prompt);
      const verdict = parseVerdict(raw);
      if (verdict?.relevante) {
        const last = context[context.length - 1];
        const matched = aiWatches[(verdict.regra ?? 1) - 1] ?? aiWatches[0];
        this.fire({
          key: `ai-${++this.keySeq}`,
          mode: 'ai',
          label: matched.label,
          reason: verdict.motivo ? `IA · ${verdict.motivo}` : `IA · ${matched.label}`,
          who: last?.participantName ?? '',
          text: last ? snippet(last.text) : '',
          t: last ? hhmm(last.capturedAt) : '',
        });
      }
    } catch {
      /* IA indisponível — silencioso; o modo por texto continua valendo */
    } finally {
      this.aiBusy = false;
    }
  }

  // ================= Disparo das ações =================
  private fire(detection: AlertDetection) {
    const now = Date.now();
    if (now - this.lastFireAt < GLOBAL_COOLDOWN_MS) return;
    this.lastFireAt = now;

    // 1) banner in-app + histórico + badge no sininho
    store.pushAlert(detection);

    // 2) notificação do Chrome (alcança você em outra aba) + badge no ícone — sempre que armado
    chrome.runtime.sendMessage(
      {
        type: 'meetsync:alert',
        title: detection.reason,
        message: detection.who ? `${detection.who}: "${detection.text}"` : detection.text,
        notify: true,
        badge: true,
      },
      () => void chrome.runtime.lastError,
    );

    // 3) bipe opcional
    if (store.get().settings.alertSound) this.beep();
  }

  /** Dispara um alerta de teste (botão "Simular detecção" na UI). */
  simulate(detection: AlertDetection) {
    this.lastFireAt = 0; // ignora cooldown em testes manuais
    this.fire(detection);
  }

  private beep() {
    try {
      this.audioCtx ??= new AudioContext();
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') void ctx.resume();
      const t0 = ctx.currentTime;
      for (const [i, freq] of [880, 1175].entries()) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = t0 + i * 0.16;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.16);
      }
    } catch {
      /* sem áudio disponível */
    }
  }
}

function snippet(text: string): string {
  const t = text.trim();
  return t.length > SNIPPET_MAX ? `${t.slice(0, SNIPPET_MAX - 1)}…` : t;
}

function buildAiPrompt(interests: string, lines: string): string {
  return [
    'Você monitora uma reunião para um participante que NÃO está prestando atenção agora.',
    'Avise-o apenas quando algo nas falas tocar em um dos interesses abaixo.',
    '',
    'Interesses monitorados (numerados):',
    interests,
    '',
    'Falas recentes de outras pessoas na reunião:',
    lines,
    '',
    'Responda SOMENTE com um JSON válido, sem texto antes ou depois, no formato:',
    '{"relevante": true|false, "regra": <número do interesse que casou ou null>, "motivo": "frase curta em português"}',
    'Use "relevante": true apenas se as falas realmente tocam em algum interesse.',
  ].join('\n');
}

type Verdict = { relevante: boolean; regra?: number; motivo?: string };

/** Extrai o JSON da resposta do modelo de forma tolerante. */
function parseVerdict(raw: string): Verdict | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { relevante?: unknown; regra?: unknown; motivo?: unknown };
    return {
      relevante: obj.relevante === true,
      regra: typeof obj.regra === 'number' ? obj.regra : undefined,
      motivo: typeof obj.motivo === 'string' ? obj.motivo : undefined,
    };
  } catch {
    return null;
  }
}
