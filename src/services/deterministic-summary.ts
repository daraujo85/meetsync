// Resumo/ata SEM IA — 100% determinístico, pra quem não tem/consegue rodar um servidor Ollama
// local. Não interpreta decisões, pendências ou bloqueios (isso exige entender o conteúdo, só
// um LLM faz); mas aproveita tudo que dá pra calcular com certeza via código convencional:
// participantes, duração, quem falou mais/menos, e os trechos mais "centrais" da conversa via
// TextRank (o mesmo princípio do PageRank, aplicado a um grafo de similaridade entre falas).

import { isEventSource, isSpeechSource, type MeetingSession, type TranscriptEntry } from '@/types';
import { formatTime } from './export-txt';

// Stopwords PT-BR (artigos, preposições, pronomes, verbos auxiliares comuns) — removidas antes
// de comparar as falas, pra similaridade refletir palavras de CONTEÚDO, não de gramática.
const STOPWORDS_PT = new Set([
  'a', 'o', 'as', 'os', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma',
  'uns', 'umas', 'e', 'ou', 'que', 'se', 'é', 'foi', 'foram', 'ser', 'sao', 'são', 'era', 'eram',
  'está', 'estão', 'estava', 'estavam', 'tem', 'têm', 'tinha', 'tinham', 'ter', 'com', 'sem', 'por',
  'para', 'pra', 'pro', 'ao', 'aos', 'à', 'às', 'num', 'numa', 'pelo', 'pela', 'pelos', 'pelas',
  'não', 'nao', 'sim', 'mais', 'menos', 'muito', 'muita', 'muitos', 'muitas', 'ja', 'já', 'so', 'só',
  'ai', 'aí', 'entao', 'então', 'assim', 'como', 'quando', 'onde', 'porque', 'porqué', 'pois', 'mas',
  'ele', 'ela', 'eles', 'elas', 'eu', 'tu', 'voce', 'você', 'voces', 'vocês', 'nos', 'nós', 'meu',
  'minha', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'seu', 'sua', 'seus', 'suas', 'nosso',
  'nossa', 'nossos', 'nossas', 'esse', 'essa', 'esses', 'essas', 'este', 'esta', 'estes', 'estas',
  'isso', 'isto', 'aquilo', 'aquele', 'aquela', 'aqueles', 'aquelas', 'todo', 'toda', 'todos', 'todas',
  'lá', 'la', 'aqui', 'cara', 'ne', 'né', 'tipo', 'coisa', 'coisas', 'vai', 'vamos', 'vou', 'tá', 'ta',
  'to', 'tô', 'né', 'oh', 'ah', 'eh', 'e', 'um', 'uns',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (comparação mais tolerante)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS_PT.has(w));
}

/** Similaridade estilo TextRank original: sobreposição de palavras normalizada pelo log dos tamanhos. */
function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  let common = 0;
  for (const w of b) if (setA.has(w)) common++;
  const denom = Math.log(a.length + 1) + Math.log(b.length + 1);
  return denom === 0 ? 0 : common / denom;
}

/** PageRank sobre a matriz de similaridade entre falas (TextRank). */
function textRank(sim: number[][], damping = 0.85, iterations = 30): number[] {
  const n = sim.length;
  if (n === 0) return [];
  const outSum = sim.map((row) => row.reduce((a, b) => a + b, 0));
  let scores: number[] = new Array(n).fill(1 / n);
  for (let it = 0; it < iterations; it++) {
    const next: number[] = new Array(n).fill((1 - damping) / n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j || outSum[j] === 0) continue;
        const w = sim[j]?.[i] ?? 0;
        if (w === 0) continue;
        next[i]! += damping * (w / outSum[j]!) * scores[j]!;
      }
    }
    scores = next;
  }
  return scores;
}

/** Falas/palavras por pessoa — mesmo cálculo exato usado no prompt de IA, aqui sem depender dela. */
function participationStats(session: MeetingSession): { name: string; words: number; lines: number }[] {
  const byPerson = new Map<string, { lines: number; words: number }>();
  for (const e of session.transcript) {
    if (!isSpeechSource(e.source)) continue;
    const cur = byPerson.get(e.participantName) ?? { lines: 0, words: 0 };
    cur.lines += 1;
    cur.words += e.text.trim().split(/\s+/).filter(Boolean).length;
    byPerson.set(e.participantName, cur);
  }
  return [...byPerson.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.words - a.words);
}

function formatDuration(startIso?: string, endIso?: string): string {
  if (!startIso) return '—';
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const totalMin = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}min` : `${m}min`;
}

/** Escolhe os trechos mais "centrais" da conversa via TextRank, devolvidos em ordem cronológica
 *  (a ordem de relevância do algoritmo não é uma ordem de leitura coerente). */
function pickKeyExcerpts(session: MeetingSession, max = 8): TranscriptEntry[] {
  const candidates = session.transcript.filter((e) => !isEventSource(e.source) && e.text.trim().length >= 25);
  if (candidates.length <= max) {
    return [...candidates].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  }
  const tokens = candidates.map((e) => tokenize(e.text));
  const n = candidates.length;
  const sim: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = similarity(tokens[i]!, tokens[j]!);
      sim[i]![j] = s;
      sim[j]![i] = s;
    }
  }
  const scores = textRank(sim);
  const ranked = candidates.map((e, i) => ({ e, score: scores[i] ?? 0 }));
  ranked.sort((a, b) => b.score - a.score);
  return ranked
    .slice(0, max)
    .map((r) => r.e)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

/** Monta um resumo/ata SEM IA. Usa a mesma sintaxe leve (**negrito**, "- item") do resumo por
 *  IA, então renderiza e copia pro WhatsApp igual — só o conteúdo é mais simples/extrativo. */
export function buildDeterministicSummary(session: MeetingSession, untitledLabel: string, labels: {
  title: string; disclaimer: string; meeting: string; duration: string; participants: string;
  participation: string; words: string; lines: string; excerpts: string;
}): string {
  const title = session.meetingTitle || session.meetingCode || untitledLabel;
  const stats = participationStats(session);
  const names = stats.length ? stats.map((s) => s.name) : session.participants.map((p) => p.name);
  const excerpts = pickKeyExcerpts(session);

  const lines: string[] = [
    `**${labels.title}**`,
    `_${labels.disclaimer}_`,
    '',
    `**${labels.meeting}:** ${title}`,
    `**${labels.duration}:** ${formatDuration(session.captureStartedAt, session.captureEndedAt)}`,
    `**${labels.participants} (${names.length}):** ${names.join(', ') || '—'}`,
    '',
    `**${labels.participation}**`,
    ...stats.map((s) => `- ${s.name}: ${s.words} ${labels.words} (${s.lines} ${labels.lines})`),
    '',
    `**${labels.excerpts}**`,
    ...excerpts.map((e) => `- [${formatTime(e.capturedAt)}] ${e.participantName}: ${e.text}`),
  ];
  return lines.join('\n');
}
