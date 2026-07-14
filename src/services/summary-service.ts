// Correção e resumo/ata via Ollama (§16/§17). Só roda sob ação explícita do usuário
// (download/processar) e com Ollama configurado (RF-082/084, RF-091/092, RNF-009).

import { isSpeechSource, type MeetingSession } from '@/types';
import { ollama } from './ollama-client';
import { buildTranscriptBody, formatTime } from './export-txt';
import { findPreviousMeetingSummary } from './storage-service';
import { t } from '@/i18n';

function formatDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Cláusula de vocabulário do negócio injetada nos prompts (vazia se não houver termos). */
function vocabularyClause(vocabulary?: string[]): string {
  const terms = (vocabulary ?? []).map((v) => v.trim()).filter(Boolean);
  if (!terms.length) return '';
  return t().ai.vocabularyClause(terms.join(', '));
}

/** Lista completa de participantes: une os participantes registrados com TODOS os falantes
 *  distintos da transcrição (defesa contra listas incompletas), em ordem alfabética. */
function allParticipantNames(session: MeetingSession): string[] {
  const names = new Set<string>();
  for (const p of session.participants) if (p.name) names.add(p.name);
  for (const e of session.transcript) if (e.participantName) names.add(e.participantName);
  return [...names].sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }));
}

function meetingMetadata(session: MeetingSession): string {
  const m = t().ai.meta;
  const participants = allParticipantNames(session);
  return [
    `${m.meeting}: ${session.meetingTitle || m.untitled}`,
    `${m.link}: ${session.meetingUrl || '—'}`,
    `${m.code}: ${session.meetingCode || '—'}`,
    `${m.date}: ${formatDate(session.captureStartedAt)}`,
    `${m.start}: ${formatTime(session.captureStartedAt)}`,
    `${m.end}: ${session.captureEndedAt ? formatTime(session.captureEndedAt) : m.inProgress}`,
    `${m.participants} (${participants.length}): ${participants.join(', ') || '—'}`,
  ].join('\n');
}

/** Conta as marcações de horário "[HH:MM]" — uma por linha de fala/chat. */
function countTimestamps(text: string): number {
  return (text.match(/\[\d{1,2}:\d{2}\]/g) ?? []).length;
}

/** Estatísticas de participação (falas/palavras por pessoa), calculadas direto da transcrição —
 *  não pedimos pra IA contar (LLM erra contagem); só pedimos pra organizar esse dado exato na
 *  ata. Considera só falas capturadas por legenda (ignora chat e eventos de reação/mão). */
function participationStats(session: MeetingSession): string {
  const byPerson = new Map<string, { lines: number; words: number }>();
  for (const e of session.transcript) {
    if (!isSpeechSource(e.source)) continue;
    const cur = byPerson.get(e.participantName) ?? { lines: 0, words: 0 };
    cur.lines += 1;
    cur.words += e.text.trim().split(/\s+/).filter(Boolean).length;
    byPerson.set(e.participantName, cur);
  }
  if (!byPerson.size) return '—';
  return [...byPerson.entries()]
    .sort((a, b) => b[1].words - a[1].words)
    .map(([name, v]) => `${name}: ${v.words} palavras (${v.lines} falas)`)
    .join('\n');
}

/** Corrige a transcrição. Retorna o texto corrigido (RF-085/086).
 *
 * Modelos pequenos (ex.: llama3.2:3b) às vezes ignoram a instrução "apenas corrija"
 * e devolvem um RESUMO em prosa, descartando as falas — o que apagaria a transcrição
 * inteira do arquivo exportado. Como a correção tem de preservar as linhas
 * `[HH:MM] Nome: ...`, se a saída perdeu a maioria desses horários consideramos que o
 * modelo resumiu e devolvemos a transcrição original (intacta) em vez do "resumo". */
export async function correctTranscript(
  session: MeetingSession,
  url: string,
  model: string,
  vocabulary?: string[],
): Promise<string> {
  const original = buildTranscriptBody(session);
  const prompt = t().ai.correctionPrompt(vocabularyClause(vocabulary), meetingMetadata(session), original);
  const corrected = await ollama.generate(url, model, prompt);

  const origStamps = countTimestamps(original);
  if (origStamps >= 3 && countTimestamps(corrected) < origStamps * 0.5) {
    return original; // o modelo resumiu em vez de corrigir — preserva a transcrição
  }
  return corrected;
}

/** Monta o prompt da ata: injeta estatísticas de participação (exatas) e, se houver, a ata da
 *  reunião anterior na mesma sala (continuidade — resolvido/pendente/em andamento). */
async function summaryPrompt(session: MeetingSession, vocabulary?: string[]): Promise<string> {
  const stats = participationStats(session);
  let previous = '';
  try {
    const prev = await findPreviousMeetingSummary(session);
    if (prev) previous = prev.whenISO ? `(${formatDate(prev.whenISO)})\n${prev.summaryText}` : prev.summaryText;
  } catch {
    /* segue sem continuidade */
  }
  return t().ai.summaryPrompt(vocabularyClause(vocabulary), meetingMetadata(session), buildTranscriptBody(session), stats, previous);
}

/** Gera resumo/ata (RF-095..099). */
export async function summarizeMeeting(
  session: MeetingSession,
  url: string,
  model: string,
  vocabulary?: string[],
): Promise<string> {
  return ollama.generate(url, model, await summaryPrompt(session, vocabulary));
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

/** Responde uma pergunta sobre a reunião, baseada na transcrição (com streaming).
 *  `history` carrega as perguntas/respostas anteriores para permitir follow-ups. */
export async function askMeetingStream(
  session: MeetingSession,
  url: string,
  model: string,
  history: ChatTurn[],
  question: string,
  onChunk: (accumulated: string) => void,
  vocabulary?: string[],
): Promise<string> {
  const convo = history.map((h) => `${h.role === 'user' ? 'P' : 'R'}: ${h.content}`).join('\n\n');
  const prompt = t().ai.askPrompt(vocabularyClause(vocabulary), meetingMetadata(session), buildTranscriptBody(session), convo, question);
  return ollama.generateStream(url, model, prompt, onChunk);
}

/** Gera resumo/ata com streaming: onChunk recebe o texto acumulado a cada pedaço. */
export async function summarizeMeetingStream(
  session: MeetingSession,
  url: string,
  model: string,
  onChunk: (accumulated: string) => void,
  vocabulary?: string[],
): Promise<string> {
  return ollama.generateStream(url, model, await summaryPrompt(session, vocabulary), onChunk);
}

// Modelos às vezes "se recusam" a sugerir um título (transcrição curta/pouco clara) e devolvem
// uma frase de recusa em vez de um título — sem validar isso, a recusa virava o título salvo
// (ex.: "A reunião não contém informações suficientes para sugerir um título."). Rejeita.
const TITLE_REFUSAL_RE =
  /não (é poss[ií]vel|h[aá] informa|cont[eé]m informa[cç][aã]o|consigo|foi poss[ií]vel)|not enough information|cannot (determine|generate|provide)|no (puedo|hay suficiente)|sin (t[ií]tulo|informaci[oó]n suficiente)/i;

/** Um título de reunião gerado por IA parece uma recusa/frase longa em vez de um título de
 *  verdade? Usado tanto para rejeitar na hora quanto para re-tentar títulos já corrompidos
 *  por uma geração anterior (ex.: rodada em lote antes deste fix). */
export function looksLikeBadAiTitle(title: string): boolean {
  const t = (title || '').trim();
  if (!t) return true;
  if (TITLE_REFUSAL_RE.test(t)) return true;
  return t.split(/\s+/).filter(Boolean).length > 12; // título de verdade é curto (~8 palavras)
}

/** Sugere um título curto para a reunião a partir do assunto da transcrição — usado só quando o
 *  título é o padrão da plataforma (isGenericTitle). Aplica-se apenas ao arquivo exportado;
 *  nunca é salvo no histórico. Retorna undefined se a resposta vier vazia/inválida/recusa. */
export async function suggestMeetingTitle(
  session: MeetingSession,
  url: string,
  model: string,
  vocabulary?: string[],
): Promise<string | undefined> {
  const prompt = t().ai.titlePrompt(vocabularyClause(vocabulary), buildTranscriptBody(session));
  const raw = await ollama.generate(url, model, prompt);
  const title = raw
    .split('\n')[0]!
    .replace(/^["'“”*#\s]+|["'“”*.\s]+$/g, '')
    .trim();
  if (!title || title.length > 80 || looksLikeBadAiTitle(title)) return undefined;
  return title;
}
