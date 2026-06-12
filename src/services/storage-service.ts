// Persistência local de configurações em chrome.storage.local (RF-108, RF-080).
// A transcrição da reunião EM ANDAMENTO vive em memória no store; além disso, mantemos um
// snapshot da última reunião como rede de segurança (o Meet redireciona/fecha a aba ao encerrar
// — sem isto a transcrição se perde antes do download). Tudo fica só local, nada sai do navegador.

import { DEFAULT_SETTINGS, type MeetingSession, type UserSettings } from '@/types';

const SETTINGS_KEY = 'meetsync:settings';
const LAST_MEETING_KEY = 'meetsync:lastMeeting';

/** Snapshot recuperável da última reunião capturada. */
export type SavedMeeting = {
  session: MeetingSession;
  summaryText?: string;
  /** ISO de quando foi salvo. */
  savedAt: string;
};

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

/** Salva o snapshot da reunião (sobrescreve o anterior). Chamado durante e ao encerrar a reunião. */
export async function saveLastMeeting(session: MeetingSession, summaryText?: string): Promise<void> {
  try {
    const saved: SavedMeeting = { session, summaryText, savedAt: new Date().toISOString() };
    await chrome.storage.local.set({ [LAST_MEETING_KEY]: saved });
  } catch {
    // storage indisponível — sem rede de segurança, segue só em memória.
  }
}

export async function loadLastMeeting(): Promise<SavedMeeting | null> {
  try {
    const res = await chrome.storage.local.get(LAST_MEETING_KEY);
    return (res[LAST_MEETING_KEY] as SavedMeeting | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function clearLastMeeting(): Promise<void> {
  try {
    await chrome.storage.local.remove(LAST_MEETING_KEY);
  } catch {
    /* ignora */
  }
}
