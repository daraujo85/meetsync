// Montagem e download do arquivo .txt (§6.9/6.10). O download usa um <a download> via
// Blob URL (não exige roteamento pelo background nem APIs extras).

import { isChatSource, entryKind, type MeetingSession } from '@/types';
import { t } from '@/i18n';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

// Títulos padrão que as plataformas colocam sozinhas na aba (não descrevem o assunto real):
// Meet ("Meet: xxx-yyyy-zzz"), Teams PT/EN/ES ("Reunião"/"Meeting"/"Reunión" [em/in/en "Canal"]).
// Âncora no início E no fim (^...$): sem isso, um título BOM gerado por IA que comece com a
// palavra "Reunião" (ex.: "Reunião sobre o workflow do FGTS") também batia aqui — fazendo a
// geração em lote ficar num loop infinito (o título novo "parecia" genérico de novo).
const GENERIC_TITLE_RE = /^(meet:\s*[a-z0-9-]+|reuni(ã|a)o(\s+em\s+["“].*["”])?|meeting(\s+in\s+["“].*["”])?|reuni[oó]n(\s+en\s+["“].*["”])?)$/i;

/** O título (já resolvido, ex.: de um HistoryMeta) não é descritivo — é o padrão da
 *  plataforma ou o próprio código da reunião? */
export function isGenericTitleText(title: string, meetingCode?: string): boolean {
  const t = (title || '').trim();
  if (!t) return true;
  if (meetingCode && t === meetingCode) return true;
  return GENERIC_TITLE_RE.test(t);
}

/** A reunião não tem um título descritivo real (é o padrão da plataforma ou o próprio código)? */
export function isGenericTitle(session: MeetingSession): boolean {
  return isGenericTitleText(session.meetingTitle || '', session.meetingCode);
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
  const f = t().exportFile;
  const participants =
    session.participants.length > 0
      ? [...session.participants]
          .sort((a, b) => a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }))
          .map((p) => `- ${p.name}`)
          .join('\n')
      : `- ${f.notIdentified}`;

  const lines = [
    f.headerTitle,
    '',
    `${f.meeting}: ${session.meetingTitle || f.untitledMeeting}`,
    `${f.link}: ${session.meetingUrl || '—'}`,
    `${f.code}: ${session.meetingCode || '—'}`,
    `${f.date}: ${formatDate(session.captureStartedAt)}`,
    `${f.captureStart}: ${formatTime(session.captureStartedAt)}`,
    `${f.captureEnd}: ${formatTime(session.captureEndedAt)}`,
    `${f.captureDuration}: ${formatDuration(session.captureStartedAt, session.captureEndedAt)}`,
    `${f.participantsIdentified}:`,
    participants,
    '',
    SEP,
    f.transcriptSection,
    SEP,
    '',
  ];
  return lines.join('\n');
}

/** Linhas da transcrição em ordem cronológica (RF-069/070). Inclui falas e mensagens de chat. */
export function buildTranscriptBody(session: MeetingSession): string {
  const f = t().exportFile;
  if (session.transcript.length === 0) return f.noCaptions;
  return [...session.transcript]
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .map((e) => {
      const tag = isChatSource(e.source) ? ` (${f.chatTag})` : '';
      return `[${formatTime(e.capturedAt)}] ${e.participantName}${tag}: ${e.text}`;
    })
    .join('\n');
}

export type ExportOptions = {
  includeHeader: boolean;
  summaryText?: string; // se presente e em arquivo único, anexa ao final
};

/** Bloco "RESUMO / ATA" (separador + título + texto) anexado ao final do .txt em arquivo único. */
export function summarySectionBlock(summaryText: string): string {
  return ['', SEP, t().exportFile.summarySection, SEP, '', summaryText].join('\n');
}

export function buildTxt(session: MeetingSession, opts: ExportOptions): string {
  const parts: string[] = [];
  if (opts.includeHeader) parts.push(buildHeader(session));
  parts.push(buildTranscriptBody(session));
  if (opts.summaryText) parts.push(summarySectionBlock(opts.summaryText));
  return parts.join('\n');
}

export function buildSummaryTxt(session: MeetingSession, summaryText: string): string {
  const f = t().exportFile;
  const lines = [
    f.summaryHeaderTitle,
    '',
    `${f.meeting}: ${session.meetingTitle || f.untitledMeeting}`,
    `${f.date}: ${formatDate(session.captureStartedAt)}`,
    `${f.link}: ${session.meetingUrl || '—'}`,
    '',
    summaryText,
  ];
  return lines.join('\n');
}

/** Nome de arquivo sugerido com data, horário e código (RF-071). */
export function buildFilename(session: MeetingSession, suffix = '', ext = 'txt'): string {
  const d = session.captureStartedAt ? new Date(session.captureStartedAt) : new Date();
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const code = session.meetingCode || t().exportFile.filenameMeeting;
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
    participants: [...session.participants]
      .map((p) => p.name)
      .sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' })),
    transcript: [...session.transcript]
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
      .map((e) => ({
        time: formatTime(e.capturedAt),
        capturedAt: e.capturedAt,
        speaker: e.participantName,
        text: e.text,
        kind: entryKind(e.source),
        source: e.source,
      })),
    summary: summaryText ?? null,
    source: session.provider ?? 'google-meet',
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
