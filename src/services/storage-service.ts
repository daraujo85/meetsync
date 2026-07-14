// Persistência local de configurações em chrome.storage.local (RF-108, RF-080).
// A transcrição da reunião EM ANDAMENTO vive em memória no store; além disso, mantemos um
// snapshot da última reunião como rede de segurança (o Meet redireciona/fecha a aba ao encerrar
// — sem isto a transcrição se perde antes do download). Tudo fica só local, nada sai do navegador.

import { DEFAULT_SETTINGS, type MeetingProvider, type MeetingSession, type UserSettings } from '@/types';
import { t } from '@/i18n';

const SETTINGS_KEY = 'meetsync:settings';
const LAST_MEETING_KEY = 'meetsync:lastMeeting'; // legado (0.3.0) — migrado para o histórico
const HISTORY_KEY = 'meetsync:history'; // índice leve (metadados) para a lista
const MEETING_PREFIX = 'meetsync:meeting:'; // dados completos por reunião
const HISTORY_CAP = 40; // máximo de reuniões guardadas (poda as mais antigas)
const OPEN_HISTORY_KEY = 'meetsync:openHistory'; // sinaliza pra aba do Meet abrir o histórico ao carregar

/** Pede que a próxima aba do Meet a carregar abra o histórico (usado pelo popup fora do Meet). */
export async function requestOpenHistory(): Promise<void> {
  try {
    await chrome.storage.local.set({ [OPEN_HISTORY_KEY]: true });
  } catch {
    /* ignora */
  }
}

/** Consome o sinal de abrir histórico (retorna true uma única vez). */
export async function consumeOpenHistory(): Promise<boolean> {
  try {
    const res = await chrome.storage.local.get(OPEN_HISTORY_KEY);
    if (res[OPEN_HISTORY_KEY]) {
      await chrome.storage.local.remove(OPEN_HISTORY_KEY);
      return true;
    }
  } catch {
    /* ignora */
  }
  return false;
}

/** Dados completos de uma reunião salva. */
export type SavedMeeting = {
  session: MeetingSession;
  summaryText?: string;
  /** ISO de quando foi salvo. */
  savedAt: string;
};

/** Metadado leve para a lista do histórico (sem o transcript inteiro). */
export type HistoryMeta = {
  id: string;
  /** Plataforma da reunião (para o ícone na lista). Default 'google-meet' (dados antigos). */
  provider: MeetingProvider;
  title: string;
  meetingCode: string;
  savedAt: string;
  startISO?: string;
  endISO?: string;
  durationMin: number;
  lines: number;
  chats: number;
  participants: string[];
  hasSummary: boolean;
  starred: boolean;
  /** Prévia da primeira fala (para o card da lista). */
  preview?: { who: string; text: string };
};

function metaFromSession(session: MeetingSession, summaryText: string | undefined, savedAt: string, starred: boolean): HistoryMeta {
  const start = session.captureStartedAt;
  const end = session.captureEndedAt ?? savedAt;
  let durationMin = 0;
  if (start) durationMin = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  const first = [...session.transcript].sort((a, b) => (a.capturedAt < b.capturedAt ? -1 : a.capturedAt > b.capturedAt ? 1 : 0))[0];
  return {
    id: session.id,
    provider: session.provider ?? 'google-meet',
    title: session.meetingTitle || session.meetingCode || t().history.meetingFallback,
    meetingCode: session.meetingCode,
    savedAt,
    startISO: start,
    endISO: session.captureEndedAt,
    durationMin,
    lines: session.transcript.length,
    chats: session.transcript.filter((e) => e.source === 'google-meet-chat').length,
    participants: session.participants.map((p) => p.name),
    hasSummary: !!summaryText,
    starred,
    preview: first ? { who: first.participantName, text: first.text } : undefined,
  };
}

export async function loadSettings(): Promise<UserSettings> {
  try {
    const res = await chrome.storage.local.get(SETTINGS_KEY);
    const stored = res[SETTINGS_KEY] as Partial<UserSettings> | undefined;
    return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  } catch {
    // storage indisponível — segue só em memória.
  }
}

/**
 * Salva/atualiza uma reunião no histórico (upsert por session.id). Chamado durante a captura e
 * ao encerrar. Mantém o índice (metadados) ordenado do mais novo ao mais antigo e poda o excesso.
 */
/** Leitura crua do índice (sem migração) — usada internamente para evitar recursão. */
async function readIndex(): Promise<HistoryMeta[]> {
  try {
    const res = await chrome.storage.local.get(HISTORY_KEY);
    return (res[HISTORY_KEY] as HistoryMeta[] | undefined) ?? [];
  } catch {
    return [];
  }
}

export async function saveMeeting(session: MeetingSession, summaryText?: string): Promise<void> {
  if (!session.id || session.transcript.length === 0) return;
  const savedAt = new Date().toISOString();
  const current = await readIndex();
  const prevStarred = current.find((m) => m.id === session.id)?.starred ?? false;
  const meta = metaFromSession(session, summaryText, savedAt, prevStarred);
  const full: SavedMeeting = { session, summaryText, savedAt };

  let index = [meta, ...current.filter((m) => m.id !== session.id)];

  // Poda: remove as mais antigas além do limite, apagando também seus dados completos.
  const pruned = index.slice(HISTORY_CAP);
  index = index.slice(0, HISTORY_CAP);

  try {
    await chrome.storage.local.set({ [HISTORY_KEY]: index, [MEETING_PREFIX + session.id]: full });
    if (pruned.length) await chrome.storage.local.remove(pruned.map((m) => MEETING_PREFIX + m.id));
  } catch {
    // Provável estouro de quota: tenta liberar a reunião mais antiga e salvar de novo, uma vez.
    const oldest = index[index.length - 1];
    if (oldest && oldest.id !== session.id) {
      try {
        await chrome.storage.local.remove(MEETING_PREFIX + oldest.id);
        await chrome.storage.local.set({ [HISTORY_KEY]: index.slice(0, -1), [MEETING_PREFIX + session.id]: full });
      } catch {
        /* desiste — segue em memória */
      }
    }
  }
}

/** Índice do histórico (metadados), mais novo primeiro. Migra o formato legado 0.3.0 se preciso. */
export async function loadHistory(): Promise<HistoryMeta[]> {
  try {
    const res = await chrome.storage.local.get([HISTORY_KEY, LAST_MEETING_KEY]);
    const index = res[HISTORY_KEY] as HistoryMeta[] | undefined;
    if (index && index.length) return index;
    // Migração: importa o snapshot único da 0.3.0, se existir (saveMeeting usa readIndex → sem recursão).
    const legacy = res[LAST_MEETING_KEY] as SavedMeeting | undefined;
    if (legacy?.session?.transcript?.length) {
      await saveMeeting(legacy.session, legacy.summaryText);
      await chrome.storage.local.remove(LAST_MEETING_KEY);
      return readIndex();
    }
    return [];
  } catch {
    return [];
  }
}

export async function loadMeeting(id: string): Promise<SavedMeeting | null> {
  try {
    const res = await chrome.storage.local.get(MEETING_PREFIX + id);
    return (res[MEETING_PREFIX + id] as SavedMeeting | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Renomeia uma reunião do histórico (índice + dados completos) — usado ao aplicar um título
 *  sugerido por IA em lote. Diferente do download com IA, aqui o título É persistido. */
export async function renameMeeting(id: string, title: string): Promise<void> {
  try {
    const index = await loadHistory();
    const meta = index.find((m) => m.id === id);
    if (meta) meta.title = title;
    await chrome.storage.local.set({ [HISTORY_KEY]: index });

    const res = await chrome.storage.local.get(MEETING_PREFIX + id);
    const saved = res[MEETING_PREFIX + id] as SavedMeeting | undefined;
    if (saved) {
      saved.session.meetingTitle = title;
      await chrome.storage.local.set({ [MEETING_PREFIX + id]: saved });
    }
  } catch {
    /* falha ao renomear — ignora, mantém título anterior */
  }
}

/** Persiste um resumo/ata gerado por download com IA de volta no registro da reunião (índice
 *  + dados completos) — sem isso o histórico continuava marcando "Sem ata" mesmo depois de o
 *  usuário já ter gerado a ata via "Baixar .txt com IA". Não mexe em savedAt/ordem da lista. */
export async function updateMeetingSummary(id: string, summaryText: string): Promise<void> {
  try {
    const index = await loadHistory();
    const meta = index.find((m) => m.id === id);
    if (meta) meta.hasSummary = true;
    await chrome.storage.local.set({ [HISTORY_KEY]: index });

    const res = await chrome.storage.local.get(MEETING_PREFIX + id);
    const saved = res[MEETING_PREFIX + id] as SavedMeeting | undefined;
    if (saved) {
      saved.summaryText = summaryText;
      await chrome.storage.local.set({ [MEETING_PREFIX + id]: saved });
    }
  } catch {
    /* falha ao salvar a ata — ignora, o arquivo já foi baixado com a ata mesmo assim */
  }
}

// ---- Backup de reunião (exportar/importar entre dispositivos) ----
const BACKUP_SCHEMA = 'meetsync-backup';
const BACKUP_SCHEMA_VERSION = 1;

export type MeetingBackup = {
  schema: typeof BACKUP_SCHEMA;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  starred: boolean;
  saved: SavedMeeting;
};

/** Monta o JSON de backup de uma reunião — dá pra importar em outro dispositivo (com
 *  transcrição, resumo e todas as funcionalidades funcionando normalmente, como se tivesse
 *  sido capturada ali). Distinto do .json de export-txt (esse é pra automações/IA). */
export function buildMeetingBackup(meta: HistoryMeta, saved: SavedMeeting): string {
  const backup: MeetingBackup = { schema: BACKUP_SCHEMA, schemaVersion: BACKUP_SCHEMA_VERSION, starred: meta.starred, saved };
  return JSON.stringify(backup, null, 2);
}

/** Importa um backup gerado por buildMeetingBackup: grava a reunião no histórico deste
 *  dispositivo (upsert por session.id — reimportar o mesmo arquivo atualiza, não duplica). */
export async function importMeetingBackup(json: string): Promise<{ ok: true } | { ok: false; error: 'invalid_json' | 'invalid_schema' }> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  const d = data as Partial<MeetingBackup> | null;
  const session = d?.saved?.session;
  if (d?.schema !== BACKUP_SCHEMA || !session?.id || !Array.isArray(session.transcript)) {
    return { ok: false, error: 'invalid_schema' };
  }
  await saveMeeting(session, d.saved?.summaryText);
  if (d.starred) await setMeetingStarred(session.id, true);
  return { ok: true };
}

export async function deleteMeeting(id: string): Promise<void> {
  try {
    const index = (await loadHistory()).filter((m) => m.id !== id);
    await chrome.storage.local.set({ [HISTORY_KEY]: index });
    await chrome.storage.local.remove(MEETING_PREFIX + id);
  } catch {
    /* ignora */
  }
}

export async function setMeetingStarred(id: string, starred: boolean): Promise<void> {
  try {
    const index = (await loadHistory()).map((m) => (m.id === id ? { ...m, starred } : m));
    await chrome.storage.local.set({ [HISTORY_KEY]: index });
  } catch {
    /* ignora */
  }
}
