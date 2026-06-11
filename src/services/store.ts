// Store central do MeetSync: estado em memória + pub/sub mínimo (sem framework).
// A UI assina mudanças e re-renderiza; módulos de captura/IA escrevem aqui.

import {
  DEFAULT_SETTINGS,
  type CaptureStatus,
  type MeetingSession,
  type OllamaState,
  type Participant,
  type TranscriptEntry,
  type UserSettings,
} from '@/types';
import { loadSettings, saveSettings } from './storage-service';

export type UiState = {
  expanded: boolean;
  activeTab: 'transcript' | 'summary' | 'export' | 'upload';
  /** texto do último resumo/ata gerado, para exibir na aba Resumo. */
  summaryText?: string;
  /** true enquanto um resumo está sendo gerado/recebido (streaming). */
  summarizing?: boolean;
};

export type AppState = {
  inMeeting: boolean;
  captureStatus: CaptureStatus;
  /** true quando as legendas do Meet estão (acreditamos) ativas. */
  captionsOn: boolean;
  session: MeetingSession;
  settings: UserSettings;
  ollama: OllamaState;
  ui: UiState;
};

type Listener = (state: AppState) => void;

function emptySession(): MeetingSession {
  return {
    id: cryptoRandomId(),
    meetingCode: '',
    meetingUrl: '',
    participants: [],
    transcript: [],
  };
}

export function cryptoRandomId(): string {
  return crypto.randomUUID();
}

class Store {
  private state: AppState = {
    inMeeting: false,
    captureStatus: 'idle',
    captionsOn: false,
    session: emptySession(),
    settings: { ...DEFAULT_SETTINGS },
    ollama: { reachable: false, models: [], testing: false },
    ui: { expanded: false, activeTab: 'transcript' },
  };

  private listeners = new Set<Listener>();

  get(): AppState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.state);
  }

  /** Atualização rasa do estado-raiz. */
  patch(partial: Partial<AppState>) {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  patchUi(partial: Partial<UiState>) {
    this.state.ui = { ...this.state.ui, ...partial };
    this.emit();
  }

  patchOllama(partial: Partial<OllamaState>) {
    this.state.ollama = { ...this.state.ollama, ...partial };
    this.emit();
  }

  // ---- Configurações ----
  async initSettings(): Promise<void> {
    this.state.settings = await loadSettings();
    this.emit();
  }

  async updateSettings(partial: Partial<UserSettings>): Promise<void> {
    this.state.settings = { ...this.state.settings, ...partial };
    this.emit();
    await saveSettings(this.state.settings);
  }

  // ---- Sessão da reunião ----
  startSession(meta: { meetingCode: string; meetingUrl: string; meetingTitle?: string }) {
    this.state.session = {
      ...emptySession(),
      ...meta,
    };
    this.state.inMeeting = true;
    this.emit();
  }

  /** Reset total ao sair/trocar de reunião (RF-009, RF-110). */
  resetSession() {
    this.state.session = emptySession();
    this.state.inMeeting = false;
    this.state.captionsOn = false;
    this.state.captureStatus = 'idle';
    this.state.ui.summaryText = undefined;
    this.emit();
  }

  setCaptureStartedAt(iso: string) {
    if (!this.state.session.captureStartedAt) {
      this.state.session.captureStartedAt = iso; // RF-061
      this.emit();
    }
  }

  setCaptureEndedAt(iso: string) {
    this.state.session.captureEndedAt = iso; // RF-062
    this.emit();
  }

  setCaptureStatus(status: CaptureStatus) {
    this.state.captureStatus = status;
    this.emit();
  }

  setCaptionsOn(on: boolean) {
    this.state.captionsOn = on;
    this.emit();
  }

  /** Adiciona ou substitui uma fala. Falas "abertas" são atualizadas in-place pela captura. */
  upsertEntry(entry: TranscriptEntry) {
    const idx = this.state.session.transcript.findIndex((e) => e.id === entry.id);
    if (idx >= 0) {
      this.state.session.transcript[idx] = entry;
    } else {
      this.state.session.transcript.push(entry);
    }
    this.registerParticipant({ name: entry.participantName, avatarUrl: entry.participantAvatarUrl });
    this.emit();
  }

  registerParticipant(p: Participant) {
    if (!p.name) return;
    const existing = this.state.session.participants.find((x) => x.name === p.name);
    if (existing) {
      if (!existing.avatarUrl && p.avatarUrl) existing.avatarUrl = p.avatarUrl;
    } else {
      this.state.session.participants.push(p); // RF-063
    }
  }
}

export const store = new Store();
