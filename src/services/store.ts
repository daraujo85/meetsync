// Store central do MeetSync: estado em memória + pub/sub mínimo (sem framework).
// A UI assina mudanças e re-renderiza; módulos de captura/IA escrevem aqui.

import {
  DEFAULT_SETTINGS,
  type AlertDetection,
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
  activeTab: 'transcript' | 'summary' | 'alerts' | 'export' | 'upload';
  /** Modo revisão: força o painel visível fora de uma reunião (ex.: abrir histórico pelo popup). */
  review?: boolean;
  /** Sheet de histórico de reuniões aberto. */
  historyOpen?: boolean;
  /** texto do último resumo/ata gerado, para exibir na aba Resumo. */
  summaryText?: string;
  /** true enquanto um resumo está sendo gerado/recebido (streaming). */
  summarizing?: boolean;
};

/** Estado runtime dos alertas de menção (não persiste). */
export type AlertsState = {
  /** detecção atualmente exibida no banner (overlay), ou null. */
  active: AlertDetection | null;
  /** histórico recente (mais novo primeiro). */
  recent: AlertDetection[];
  /** detecções não vistas (badge no sininho / na aba). */
  unread: number;
};

export type AppState = {
  inMeeting: boolean;
  /** true depois que a reunião terminou, mas a transcrição ainda está visível para revisar/baixar. */
  ended: boolean;
  captureStatus: CaptureStatus;
  /** true quando as legendas do Meet estão (acreditamos) ativas. */
  captionsOn: boolean;
  session: MeetingSession;
  settings: UserSettings;
  ollama: OllamaState;
  ui: UiState;
  alerts: AlertsState;
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
    ended: false,
    captureStatus: 'idle',
    captionsOn: false,
    session: emptySession(),
    settings: { ...DEFAULT_SETTINGS },
    ollama: { reachable: false, models: [], testing: false },
    ui: { expanded: false, activeTab: 'transcript' },
    alerts: { active: null, recent: [], unread: 0 },
  };

  private listeners = new Set<Listener>();
  private entryListeners = new Set<(entry: TranscriptEntry) => void>();

  get(): AppState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  /** Notifica cada vez que uma fala é inserida/atualizada (usado pelo monitor de alertas). */
  onEntry(fn: (entry: TranscriptEntry) => void): () => void {
    this.entryListeners.add(fn);
    return () => this.entryListeners.delete(fn);
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
    this.state.ended = false;
    this.emit();
  }

  /** Reunião terminou: mantém a transcrição visível para revisar/baixar (não zera). */
  endSession() {
    this.state.inMeeting = false;
    this.state.ended = true;
    this.state.captionsOn = false;
    this.state.captureStatus = 'idle';
    this.state.ui.expanded = true; // abre o painel para o usuário ver/baixar
    this.emit();
  }

  /** Re-entrou na MESMA reunião (rejoin/transiente): retoma a captura SEM zerar a transcrição. */
  resumeSession() {
    this.state.inMeeting = true;
    this.state.ended = false;
    this.emit();
  }

  /** Reset total ao trocar de reunião / iniciar nova (RF-009, RF-110). */
  resetSession() {
    this.state.session = emptySession();
    this.state.inMeeting = false;
    this.state.ended = false;
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

  /** Reaplica o nome do usuário às falas/participantes JÁ capturados como "Você"/"You"
   *  (quando o nome é definido/alterado no meio da reunião). Mantém tudo consistente para a
   *  transcrição, exportações e prompts da IA. */
  relabelSelf(selfName: string) {
    const self = selfName.trim();
    if (!self) return;
    const SELF = /^(você|voce|you)$/i;
    let changed = false;
    for (const e of this.state.session.transcript) {
      if (SELF.test(e.participantName.trim())) {
        e.participantName = self;
        changed = true;
      }
    }
    const seen = new Set<string>();
    const participants: Participant[] = [];
    for (const p of this.state.session.participants) {
      const name = SELF.test(p.name.trim()) ? self : p.name;
      if (seen.has(name)) {
        changed = true;
        continue;
      }
      seen.add(name);
      participants.push({ ...p, name });
    }
    this.state.session.participants = participants;
    if (changed) this.emit();
  }

  // ---- Alertas de menção ----
  /** Registra uma detecção: mostra o banner, guarda no histórico e conta não-lidas. */
  pushAlert(detection: AlertDetection) {
    const viewing = this.state.ui.expanded && this.state.ui.activeTab === 'alerts';
    this.state.alerts = {
      active: detection,
      recent: [detection, ...this.state.alerts.recent].slice(0, 8),
      unread: viewing ? 0 : this.state.alerts.unread + 1,
    };
    this.emit();
  }

  /** Dispensa o banner (mantém o histórico). */
  dismissActiveAlert() {
    if (!this.state.alerts.active) return;
    this.state.alerts = { ...this.state.alerts, active: null };
    this.emit();
  }

  /** Zera o contador de não-lidas (ao abrir a aba Alertas). */
  clearAlertUnread() {
    if (this.state.alerts.unread === 0) return;
    this.state.alerts = { ...this.state.alerts, unread: 0 };
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
    for (const fn of this.entryListeners) fn(entry);
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
