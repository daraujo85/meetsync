// Persistência local de configurações em chrome.storage.local (RF-108, RF-080).
// A transcrição da sessão NÃO é persistida aqui por padrão: vive em memória no store
// e é isolada/limpa ao trocar de reunião (RF-110). Mantemos só as preferências do usuário.

import { DEFAULT_SETTINGS, type UserSettings } from '@/types';

const SETTINGS_KEY = 'meetsync:settings';

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
