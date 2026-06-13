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

/** Corrige a transcrição. Retorna o texto corrigido (RF-085/086). */
export async function correctTranscript(
  session: MeetingSession,
  url: string,
  model: string,
  vocabulary?: string[],
): Promise<string> {
  const prompt = t().ai.correctionPrompt(vocabularyClause(vocabulary), meetingMetadata(session), buildTranscriptBody(session));
  return ollama.generate(url, model, prompt);
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
