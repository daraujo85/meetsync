// Converte a ata (formato leve usado no prompt/preview: **negrito**, "N. item", "- item",
// "## Título") para o marcador de formatação do WhatsApp (*negrito* com um asterisco só, "•"
// para listas), com um cabeçalho e emojis por seção — pronto pra colar num chat/grupo.

import { formatTime } from './export-txt';
import type { MeetingSession } from '@/types';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** **negrito** (markdown) -> *negrito* (WhatsApp usa um asterisco só). */
function inlineToWhatsapp(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '*$1*');
}

// Emoji por seção da ata (primeiro que casar o título, sem distinguir maiúsculas/minúsculas).
const HEADING_EMOJI: [RegExp, string][] = [
  [/assunto/i, '🗒️'],
  [/decis/i, '✅'],
  [/respons[aá]ve/i, '👤'],
  [/pend[eê]ncia/i, '📌'],
  [/bloqueio/i, '🚧'],
  [/cr[ií]tico/i, '🔴'],
  [/pr[oó]ximos passos|next steps|pr[oó]ximos pasos/i, '👉'],
  [/continuidade|continuity|continuidad/i, '🔁'],
  [/participa[cç][aã]o|participation|participaci[oó]n/i, '🗣️'],
  [/aten[cç][aã]o|attention|atenci[oó]n/i, '⚠️'],
];

function headingEmoji(title: string): string {
  for (const [re, emoji] of HEADING_EMOJI) if (re.test(title)) return `${emoji} `;
  return '';
}

/** Converte o corpo da ata (mesmas regras de renderMarkdownInto no painel) pra texto WhatsApp. */
function bodyToWhatsapp(text: string): string {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      out.push('');
      continue;
    }
    // bullets "- item" / "* item" -> "• item"
    if (/^[-*]\s+/.test(line)) {
      out.push(`• ${inlineToWhatsapp(line.replace(/^[-*]\s+/, ''))}`);
      continue;
    }
    // "N. item" (com ou sem ##)
    const numbered = line.match(/^(?:#{1,6}\s+)?(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      out.push(`${numbered[1]}. ${inlineToWhatsapp(numbered[2]!)}`);
      continue;
    }
    // "## Título" ou "**Título**" -> título em negrito + emoji, em maiúsculas
    const heading = line.match(/^(?:#{1,6}\s+)?\*\*(.+?)\*\*:?\s*$/) || line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      const title = heading[1]!.replace(/:$/, '');
      out.push('', `*${headingEmoji(title)}${title.toUpperCase()}*`);
      continue;
    }
    out.push(inlineToWhatsapp(line));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Monta o texto pronto pra colar no WhatsApp: cabeçalho (título/data/hora) + ata formatada. */
export function formatSummaryForWhatsapp(session: MeetingSession, summaryText: string, untitledLabel: string): string {
  const title = session.meetingTitle || session.meetingCode || untitledLabel;
  const date = formatDate(session.captureStartedAt);
  const start = formatTime(session.captureStartedAt);
  const end = session.captureEndedAt ? formatTime(session.captureEndedAt) : '';
  const timeLine = start !== '--:--' ? `🗓️ ${date} · ⏱️ ${start}${end ? `–${end}` : ''}` : `🗓️ ${date}`;
  const header = [`*📋 Ata da Reunião*`, `*${title}*`, timeLine].join('\n');
  return `${header}\n\n${bodyToWhatsapp(summaryText)}`;
}
