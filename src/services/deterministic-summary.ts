// Resumo/ata SEM IA — 100% determinístico, pra quem não tem/consegue rodar um servidor Ollama
// local. Combina TextRank (centralidade — o mesmo princípio do PageRank, aplicado a um grafo de
// similaridade entre sentenças) com padrões de linguagem (regex) pra priorizar falas que soam
// como decisão/ação/prazo/bloqueio, e MMR pra evitar escolher várias sentenças quase repetidas.
// Continua sendo heurística: não interpreta o conteúdo (isso só um LLM faz), só prioriza melhor
// o que expor — por isso as seções de decisões/ações/prazos/bloqueios se rotulam "(heurística)".

import { isEventSource, isSpeechSource, type MeetingSession } from '@/types';
import { formatTime } from './export-txt';
import { t } from '@/i18n';

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

// Padrões (heurística) de decisão/ação/prazo/bloqueio em PT-BR. Não substituem entendimento real
// do conteúdo — só ajudam a priorizar falas que o TextRank puro poderia ignorar (ele favorece o
// tema mais repetido, e uma decisão ou bloqueio às vezes é dito uma única vez na reunião toda).
const DECISION_RE = [
  /\bficou decidido\b/i, /\bdecidimos\b/i, /\bfoi aprovado\b/i, /\bfechamos que\b/i,
  /\bcombinamos\b/i, /\bvamos seguir com\b/i, /\ba decis[aã]o (é|foi)\b/i, /\bdecis[aã]o\b/i,
  /\bficou definido\b/i, /\bvamos optar por\b/i,
];
const ACTION_RE = [
  /\beu vou\b/i, /\bfica(rá|ndo)? respons[aá]vel\b/i, /\bprecisa fazer\b/i, /\bdeve entregar\b/i,
  /\bvai verificar\b/i, /\bfica com\b/i, /\bvou (fazer|verificar|checar|providenciar|ajustar|abrir)\b/i,
  /\bpode (fazer|ficar com|assumir)\b/i, /\bassume essa\b/i,
];
const DEADLINE_RE = [
  /\bat[eé] (segunda|terça|terca|quarta|quinta|sexta|s[aá]bado|domingo)\b/i, /\bamanh[aã]\b/i,
  /\bpr[oó]xima semana\b/i, /\bat[eé] o fim do dia\b/i, /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/,
  /\b\d{1,2}h(oras?)?\b/i, /\bprazo\b/i,
];
const BLOCKER_RE = [
  /\bbloqueio\b/i, /\bimpediment[o]\b/i, /\bdependemos de\b/i, /\baguardando\b/i,
  /\bn[aã]o consegu(imos|e)\b/i, /\best[aá] parad[oa]\b/i, /\btravad[oa]\b/i, /\besperando\b/i,
];

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

interface Sentence {
  text: string;
  capturedAt: string;
  participantName: string;
  tokens: string[];
}

/** Quebra cada fala em sentenças menores (via Intl.Segmenter, com fallback por pontuação) —
 *  dá ao TextRank/MMR uma granularidade melhor do que tratar cada fala inteira como uma unidade,
 *  já que um utterance de Meet/Teams às vezes junta várias ideias num só bloco. */
function splitIntoSentences(session: MeetingSession): Sentence[] {
  const IntlAny = Intl as unknown as { Segmenter?: new (locale: string, opts: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } };
  const segmenter = IntlAny.Segmenter ? new IntlAny.Segmenter('pt-BR', { granularity: 'sentence' }) : null;

  const out: Sentence[] = [];
  for (const e of session.transcript) {
    if (isEventSource(e.source)) continue;
    const text = e.text.trim();
    if (!text) continue;
    const parts = segmenter
      ? [...segmenter.segment(text)].map((seg) => seg.segment.trim()).filter(Boolean)
      : text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (p.length < 20) continue; // muito curta, pouco informativa isolada
      out.push({ text: p, capturedAt: e.capturedAt, participantName: e.participantName, tokens: tokenize(p) });
    }
  }
  // Guarda-corpo: reuniões muito longas podem gerar milhares de sentenças, e a similaridade é
  // O(n²) — decima uniformemente em vez de deixar o cálculo explodir.
  const MAX_SENTENCES = 600;
  if (out.length <= MAX_SENTENCES) return out;
  const step = out.length / MAX_SENTENCES;
  const sampled: Sentence[] = [];
  for (let i = 0; i < MAX_SENTENCES; i++) sampled.push(out[Math.floor(i * step)]!);
  return sampled;
}

type Category = 'decision' | 'action' | 'deadline' | 'blocker' | 'question' | 'general';

function matchesAny(patterns: RegExp[], text: string): boolean {
  return patterns.some((re) => re.test(text));
}

function categorize(text: string): Category {
  if (matchesAny(DECISION_RE, text)) return 'decision';
  if (matchesAny(BLOCKER_RE, text)) return 'blocker';
  if (matchesAny(ACTION_RE, text)) return 'action';
  if (matchesAny(DEADLINE_RE, text)) return 'deadline';
  if (text.trim().endsWith('?')) return 'question'; // pergunta que ninguém categorizou como decisão/ação — candidata a "questão em aberto"
  return 'general';
}

/** Similaridade cosseno por frequência de palavras (bag-of-words) — usada na segmentação por
 *  tópico (TextTiling), que compara BLOCOS de sentenças em vez de pares individuais. */
function cosineTokens(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const freqA = new Map<string, number>();
  for (const w of a) freqA.set(w, (freqA.get(w) ?? 0) + 1);
  const freqB = new Map<string, number>();
  for (const w of b) freqB.set(w, (freqB.get(w) ?? 0) + 1);
  let dot = 0;
  for (const [w, c] of freqA) dot += c * (freqB.get(w) ?? 0);
  const normA = Math.sqrt([...freqA.values()].reduce((s, c) => s + c * c, 0));
  const normB = Math.sqrt([...freqB.values()].reduce((s, c) => s + c * c, 0));
  return normA && normB ? dot / (normA * normB) : 0;
}

/** TextTiling simplificado: desliza uma janela de N sentenças por cima da transcrição e mede a
 *  similaridade entre o bloco-antes e o bloco-depois de cada "fronteira" candidata. Vales bem mais
 *  fundos que os picos vizinhos (métrica de "profundidade") marcam onde o assunto provavelmente
 *  mudou. Impõe um tamanho mínimo de segmento pra não fatiar demais transcrições curtas/ruidosas. */
function segmentByTopic(sentences: Sentence[], windowSize = 3, minSegmentLen = 5, maxSegments = 6): Sentence[][] {
  const n = sentences.length;
  if (n < minSegmentLen * 2) return [sentences];

  const gapScores: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const leftStart = Math.max(0, i - windowSize + 1);
    const rightEnd = Math.min(n - 1, i + windowSize);
    const leftTokens = sentences.slice(leftStart, i + 1).flatMap((s) => s.tokens);
    const rightTokens = sentences.slice(i + 1, rightEnd + 1).flatMap((s) => s.tokens);
    gapScores.push(cosineTokens(leftTokens, rightTokens));
  }

  const depth = gapScores.map((score, i) => {
    let leftPeak = score;
    for (let j = i - 1; j >= 0 && gapScores[j]! >= gapScores[j + 1]!; j--) leftPeak = Math.max(leftPeak, gapScores[j]!);
    let rightPeak = score;
    for (let j = i + 1; j < gapScores.length && gapScores[j]! >= gapScores[j - 1]!; j++) rightPeak = Math.max(rightPeak, gapScores[j]!);
    return (leftPeak - score) + (rightPeak - score);
  });

  // Rankeia os vales pela PROFUNDIDADE (maior troca de assunto primeiro) — não pela posição. Se
  // ordenássemos por posição, uma reunião com muita conversa fiada nos primeiros minutos (muitas
  // trocas de assunto pequenas) esgotaria o teto de segmentos logo ali, e o resto inteiro da
  // reunião viraria um único bloco gigante (foi exatamente o bug observado: 5 segmentos nos
  // primeiros 7min + 1 segmento cobrindo os 50min restantes).
  const ranked = depth
    .map((d, i) => ({ i, d }))
    .filter(({ d }) => d > 0)
    .sort((a, b) => b.d - a.d);

  const boundaries: number[] = [];
  for (const { i } of ranked) {
    if (boundaries.length >= maxSegments - 1) break;
    const b = i + 1; // fronteira logo depois da sentença i
    if (b < minSegmentLen || n - b < minSegmentLen) continue;
    if (boundaries.some((existing) => Math.abs(existing - b) < minSegmentLen)) continue;
    boundaries.push(b);
  }
  boundaries.sort((a, b) => a - b);

  const segments: Sentence[][] = [];
  let start = 0;
  for (const b of boundaries) {
    segments.push(sentences.slice(start, b));
    start = b;
  }
  segments.push(sentences.slice(start));
  return segments;
}

/** Rótulo curto de um segmento: as palavras de conteúdo mais frequentes nele (aproxima o "tema"
 *  sem exigir entendimento real do texto). */
function topicLabel(segment: Sentence[], max = 3): string {
  const freq = new Map<string, number>();
  for (const s of segment) for (const w of s.tokens) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w)
    .join(', ') || '—';
}

/** MMR (Maximal Marginal Relevance): a cada passo escolhe o item com melhor equilíbrio entre
 *  score próprio e "distância" do que já foi escolhido. lambda alto = prioriza score; lambda
 *  baixo = prioriza diversidade. Além de desempatar por diversidade, DESCARTA de vez (não só
 *  desprioriza) candidatos quase idênticos a algo já escolhido — sem isso, quando o "banco" de
 *  candidatos de uma categoria é pequeno (ex.: alguém repete a mesma decisão em 3 falas seguidas),
 *  o MMR acaba pegando as 3 quase-cópias só pra preencher a cota. */
function selectWithMMR(items: { sentence: Sentence; score: number }[], limit: number, lambda = 0.7, dedupThreshold = 0.75): Sentence[] {
  const selected: { sentence: Sentence; score: number }[] = [];
  const remaining = [...items];
  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = -1;
    let bestMmr = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i]!;
      const redundancy = selected.length === 0
        ? 0
        : Math.max(...selected.map((s) => similarity(cand.sentence.tokens, s.sentence.tokens)));
      if (redundancy > dedupThreshold) continue; // quase-cópia de algo já escolhido — descarta de vez
      const mmr = lambda * cand.score - (1 - lambda) * redundancy;
      if (mmr > bestMmr) { bestMmr = mmr; bestIdx = i; }
    }
    if (bestIdx === -1) break; // só sobraram quase-cópias — para em vez de forçar a cota
    selected.push(remaining.splice(bestIdx, 1)[0]!);
  }
  return selected.map((s) => s.sentence).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

interface TopicSummary {
  label: string;
  startAt: string;
  endAt: string;
  highlight: Sentence;
}

interface StructuredExcerpts {
  executive: Sentence[];
  topics: TopicSummary[];
  decisions: Sentence[];
  actions: Sentence[];
  deadlines: Sentence[];
  blockers: Sentence[];
  questions: Sentence[];
}

const QUOTAS: Record<Category, number> = {
  decision: 5, action: 8, deadline: 4, blocker: 4, question: 4, general: 3,
};

/** Pipeline completo: sentenças → TextTiling (segmenta por assunto) → TextRank (centralidade,
 *  no grafo da reunião inteira) → pontuação multiobjetivo (centralidade + categoria por regex) →
 *  agrupa por categoria → MMR dentro de cada categoria/segmento pra tirar redundância. */
function pickStructuredExcerpts(session: MeetingSession): StructuredExcerpts {
  const sentences = splitIntoSentences(session);
  const empty: StructuredExcerpts = {
    executive: [], topics: [], decisions: [], actions: [], deadlines: [], blockers: [], questions: [],
  };
  if (!sentences.length) return empty;

  const n = sentences.length;
  const sim: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = similarity(sentences[i]!.tokens, sentences[j]!.tokens);
      sim[i]![j] = s;
      sim[j]![i] = s;
    }
  }
  const centrality = textRank(sim);
  const maxCentrality = Math.max(...centrality, 1e-9);

  const buckets: Record<Category, { sentence: Sentence; score: number }[]> = {
    decision: [], action: [], deadline: [], blocker: [], question: [], general: [],
  };
  sentences.forEach((sentence, i) => {
    const cat = categorize(sentence.text);
    const centralityScore = (centrality[i] ?? 0) / maxCentrality; // normaliza 0..1
    // Sentenças categorizadas (decisão/ação/prazo/bloqueio/pergunta) ganham um bônus fixo — sem
    // isso, o TextRank puro tende a ignorar uma decisão citada uma única vez em favor do tema
    // mais repetido.
    const catBoost = cat !== 'general' ? 0.5 : 0;
    buckets[cat].push({ sentence, score: centralityScore * 0.6 + catBoost });
  });
  for (const k of Object.keys(buckets) as Category[]) buckets[k].sort((a, b) => b.score - a.score);

  // Assuntos discutidos: segmenta a reunião por tópico (TextTiling) e destaca, de cada segmento,
  // a sentença mais central — dá uma visão "linha do tempo de assuntos" que o TextRank sozinho
  // (que só enxerga a reunião inteira como um bloco) não consegue produzir.
  const segments = segmentByTopic(sentences);
  const indexOf = new Map<Sentence, number>();
  sentences.forEach((s, i) => indexOf.set(s, i));
  const topics: TopicSummary[] = segments.map((segment) => {
    let best = segment[0]!;
    let bestScore = -Infinity;
    for (const s of segment) {
      const score = centrality[indexOf.get(s)!] ?? 0;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return {
      label: topicLabel(segment),
      startAt: segment[0]!.capturedAt,
      endAt: segment[segment.length - 1]!.capturedAt,
      highlight: best,
    };
  });

  return {
    executive: selectWithMMR(buckets.general, QUOTAS.general),
    topics,
    decisions: selectWithMMR(buckets.decision, QUOTAS.decision),
    actions: selectWithMMR(buckets.action, QUOTAS.action),
    deadlines: selectWithMMR(buckets.deadline, QUOTAS.deadline),
    blockers: selectWithMMR(buckets.blocker, QUOTAS.blocker),
    questions: selectWithMMR(buckets.question, QUOTAS.question),
  };
}

/** Monta um resumo/ata SEM IA. Usa a mesma sintaxe leve (**negrito**, "- item") do resumo por
 *  IA, então renderiza e copia pro WhatsApp igual — só o conteúdo é mais simples/extrativo. */
export function buildDeterministicSummary(session: MeetingSession, untitledLabel: string, labels: {
  title: string; disclaimer: string; meeting: string; duration: string; participants: string;
  participation: string; words: string; lines: string; executive: string; topics: string;
  decisions: string; actions: string; deadlines: string; blockers: string; questions: string;
  noneFound: string;
}): string {
  const title = session.meetingTitle || session.meetingCode || untitledLabel;
  const stats = participationStats(session);
  const names = stats.length ? stats.map((s) => s.name) : session.participants.map((p) => p.name);
  const picked = pickStructuredExcerpts(session);

  const section = (heading: string, items: Sentence[]): string => {
    const body = items.length
      ? items.map((e) => `- [${formatTime(e.capturedAt)}] ${e.participantName}: ${e.text}`).join('\n')
      : `- ${labels.noneFound}`;
    return `**${heading}**\n${body}`;
  };

  const topicsSection = (): string => {
    const body = picked.topics.length
      ? picked.topics
        .map((tp) => `- [${formatTime(tp.startAt)}–${formatTime(tp.endAt)}] ${tp.label} — "${tp.highlight.text}"`)
        .join('\n')
      : `- ${labels.noneFound}`;
    return `**${labels.topics}**\n${body}`;
  };

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
    section(labels.executive, picked.executive),
    '',
    topicsSection(),
    '',
    section(labels.decisions, picked.decisions),
    '',
    section(labels.actions, picked.actions),
    '',
    section(labels.deadlines, picked.deadlines),
    '',
    section(labels.blockers, picked.blockers),
    '',
    section(labels.questions, picked.questions),
  ];
  return lines.join('\n');
}

/** Atalho: monta o resumo sem IA já com as labels do idioma ativo (evita repetir esse objeto
 *  em cada chamador — histórico, painel ao vivo, popup). */
export function buildDeterministicSummaryI18n(session: MeetingSession): string {
  const hi = t().history;
  return buildDeterministicSummary(session, t().exportFile.untitledMeeting, {
    title: hi.noAiSummaryTitle,
    disclaimer: hi.noAiSummaryDisclaimer,
    meeting: hi.noAiSummaryMeeting,
    duration: hi.noAiSummaryDuration,
    participants: hi.noAiSummaryParticipants,
    participation: hi.noAiSummaryParticipation,
    words: hi.noAiSummaryWords,
    lines: hi.noAiSummaryLines,
    executive: hi.noAiSummaryExecutive,
    topics: hi.noAiSummaryTopics,
    decisions: hi.noAiSummaryDecisions,
    actions: hi.noAiSummaryActions,
    deadlines: hi.noAiSummaryDeadlines,
    blockers: hi.noAiSummaryBlockers,
    questions: hi.noAiSummaryQuestions,
    noneFound: hi.noAiSummaryNoneFound,
  });
}
