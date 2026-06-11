// Modelo de dados do MeetSync (§12 do PRD).

export type Participant = {
  id?: string;
  name: string;
  avatarUrl?: string;
};

export type TranscriptEntry = {
  id: string;
  participantName: string;
  participantAvatarUrl?: string;
  text: string;
  /** ISO 8601, horário local de captura da fala (RF-044). */
  capturedAt: string;
  source: 'google-meet-caption' | 'google-meet-chat';
};

export type MeetingSession = {
  id: string;
  meetingCode: string;
  meetingUrl: string;
  meetingTitle?: string;
  captureStartedAt?: string;
  captureEndedAt?: string;
  participants: Participant[];
  transcript: TranscriptEntry[];
};

export type UserSettings = {
  autoEnableCaptions: boolean;
  includeHeaderByDefault: boolean;
  ollamaUrl: string;
  ollamaModel?: string;
  enableAiCorrection: boolean;
  includeSummary: boolean;
  separateSummaryFile: boolean;
  /** Atualiza o resumo/ata automaticamente durante a reunião (aba Resumo). */
  realtimeSummary: boolean;
  /** Intervalo (minutos) entre atualizações do resumo em tempo real. Presets: 1/2/5/10. */
  summaryIntervalMin: number;
  /** Abre o painel de chat do Meet automaticamente para capturar as mensagens de texto. */
  autoOpenChat: boolean;
  /** Também baixa um .json estruturado (para agentes de IA / automações). */
  exportJson: boolean;
};

/** Estado de captura mostrado na UI (§10.6). */
export type CaptureStatus =
  | 'idle' // fora de reunião
  | 'waiting' // em reunião, legendas desligadas ("Aguardando legendas")
  | 'capturing' // legendas ativas, capturando ("Captura ativa")
  | 'processing' // Ollama processando
  | 'error'; // erro de IA

export type OllamaState = {
  reachable: boolean;
  models: string[];
  lastError?: string;
  testing: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
  autoEnableCaptions: true,
  includeHeaderByDefault: true, // RF-068/101
  ollamaUrl: 'http://localhost:11434', // RF-075
  ollamaModel: undefined,
  enableAiCorrection: false, // RF-083: desativado por padrão
  includeSummary: false,
  separateSummaryFile: false,
  realtimeSummary: false,
  summaryIntervalMin: 2,
  autoOpenChat: true,
  exportJson: false,
};
