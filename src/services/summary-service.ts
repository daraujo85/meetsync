// Correção e resumo/ata via Ollama (§16/§17). Só roda sob ação explícita do usuário
// (download/processar) e com Ollama configurado (RF-082/084, RF-091/092, RNF-009).

import type { MeetingSession } from '@/types';
import { ollama } from './ollama-client';
import { buildTranscriptBody, formatTime } from './export-txt';
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

function meetingMetadata(session: MeetingSession): string {
  const m = t().ai.meta;
  return [
    `${m.meeting}: ${session.meetingTitle || m.untitled}`,
    `${m.link}: ${session.meetingUrl || '—'}`,
    `${m.code}: ${session.meetingCode || '—'}`,
    `${m.date}: ${formatDate(session.captureStartedAt)}`,
    `${m.start}: ${formatTime(session.captureStartedAt)}`,
    `${m.end}: ${session.captureEndedAt ? formatTime(session.captureEndedAt) : m.inProgress}`,
    `${m.participants}: ${session.participants.map((p) => p.name).join(', ') || '—'}`,
  ].join('\n');
}

/** Conta as marcações de horário "[HH:MM]" — uma por linha de fala/chat. */
function countTimestamps(text: string): number {
  return (text.match(/\[\d{1,2}:\d{2}\]/g) ?? []).length;
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

function summaryPrompt(session: MeetingSession, vocabulary?: string[]): string {
  return t().ai.summaryPrompt(vocabularyClause(vocabulary), meetingMetadata(session), buildTranscriptBody(session));
}

/** Gera resumo/ata (RF-095..099). */
export async function summarizeMeeting(
  session: MeetingSession,
  url: string,
  model: string,
  vocabulary?: string[],
): Promise<string> {
  return ollama.generate(url, model, summaryPrompt(session, vocabulary));
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
  return ollama.generateStream(url, model, summaryPrompt(session, vocabulary), onChunk);
}
