// Montagem e download do arquivo .txt (§6.9/6.10). O download usa um <a download> via
// Blob URL (não exige roteamento pelo background nem APIs extras).

import type { MeetingSession } from '@/types';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** HH:MM em horário local a partir de ISO. */
export function formatTime(iso?: string): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Duração no formato "1h07min" / "07min". */
function formatDuration(startIso?: string, endIso?: string): string {
  if (!startIso) return '—';
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const totalMin = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${pad(m)}min` : `${m}min`;
}

const SEP = '------------------------------------------------------------';

/** Cabeçalho do §6.10 (RF-066). */
export function buildHeader(session: MeetingSession): string {
  const participants =
    session.participants.length > 0
      ? session.participants.map((p) => `- ${p.name}`).join('\n')
      : '- (não identificados)';

  const lines = [
    'MEETSYNC — TRANSCRIÇÃO DA REUNIÃO',
    '',
    `Reunião: ${session.meetingTitle || 'Reunião sem título'}`,
    `Link: ${session.meetingUrl || '—'}`,
    `Código: ${session.meetingCode || '—'}`,
    `Data: ${formatDate(session.captureStartedAt)}`,
    `Início da captura: ${formatTime(session.captureStartedAt)}`,
    `Fim da captura: ${formatTime(session.captureEndedAt)}`,
    `Duração da captura: ${formatDuration(session.captureStartedAt, session.captureEndedAt)}`,
    'Participantes identificados:',
    participants,
    '',
    SEP,
    'TRANSCRIÇÃO',
    SEP,
    '',
  ];
  return lines.join('\n');
}

/** Linhas da transcrição em ordem cronológica (RF-069/070). Inclui falas e mensagens de chat. */
export function buildTranscriptBody(session: MeetingSession): string {
  if (session.transcript.length === 0) return '(sem falas capturadas)';
  return [...session.transcript]
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .map((e) => {
      const tag = e.source === 'google-meet-chat' ? ' (chat)' : '';
      return `[${formatTime(e.capturedAt)}] ${e.participantName}${tag}: ${e.text}`;
    })
    .join('\n');
}

export type ExportOptions = {
  includeHeader: boolean;
  summaryText?: string; // se presente e em arquivo único, anexa ao final
};

export function buildTxt(session: MeetingSession, opts: ExportOptions): string {
  const parts: string[] = [];
  if (opts.includeHeader) parts.push(buildHeader(session));
  parts.push(buildTranscriptBody(session));
  if (opts.summaryText) {
    parts.push('', SEP, 'RESUMO / ATA', SEP, '', opts.summaryText);
  }
  return parts.join('\n');
}

export function buildSummaryTxt(session: MeetingSession, summaryText: string): string {
  const lines = [
    'MEETSYNC — RESUMO / ATA DA REUNIÃO',
    '',
    `Reunião: ${session.meetingTitle || 'Reunião sem título'}`,
    `Data: ${formatDate(session.captureStartedAt)}`,
    `Link: ${session.meetingUrl || '—'}`,
    '',
    summaryText,
  ];
  return lines.join('\n');
}

/** Nome de arquivo sugerido com data, horário e código (RF-071). */
export function buildFilename(session: MeetingSession, suffix = '', ext = 'txt'): string {
  const d = session.captureStartedAt ? new Date(session.captureStartedAt) : new Date();
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const code = session.meetingCode || 'reuniao';
  return `MeetSync_${stamp}_${code}${suffix}.${ext}`;
}

/** Payload estruturado (PRD §12) para agentes de IA / automações consumirem a reunião. */
export function buildMeetingJson(session: MeetingSession, summaryText?: string): string {
  const obj = {
    meetingTitle: session.meetingTitle ?? null,
    meetingUrl: session.meetingUrl,
    meetingCode: session.meetingCode,
    captureStartedAt: session.captureStartedAt ?? null,
    captureEndedAt: session.captureEndedAt ?? null,
    participants: session.participants.map((p) => p.name),
    transcript: [...session.transcript]
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
      .map((e) => ({
        time: formatTime(e.capturedAt),
        capturedAt: e.capturedAt,
        speaker: e.participantName,
        text: e.text,
        kind: e.source === 'google-meet-chat' ? 'chat' : 'speech',
        source: e.source,
      })),
    summary: summaryText ?? null,
    source: 'google-meet',
  };
  return JSON.stringify(obj, null, 2);
}

/** Dispara o download de um conteúdo de texto. */
export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
