// Modelo de dados do MeetSync (§12 do PRD).

import type { Locale } from '@/i18n';

export type Participant = {
  id?: string;
  name: string;
  avatarUrl?: string;
};

/** Plataforma de reunião suportada. */
export type MeetingProvider = 'google-meet' | 'microsoft-teams';

export type TranscriptEntry = {
  id: string;
  participantName: string;
  participantAvatarUrl?: string;
  text: string;
  /** ISO 8601, horário local de captura da fala (RF-044). */
  capturedAt: string;
  source:
    | 'google-meet-caption'
    | 'google-meet-chat'
    | 'microsoft-teams-caption'
    | 'microsoft-teams-chat'
    | 'microsoft-teams-event'; // reação / mão levantada
};

/** É uma mensagem de chat (independente da plataforma)? Usado no export/JSON. */
export function isChatSource(source: TranscriptEntry['source']): boolean {
  return source.endsWith('-chat');
}

/** É um evento da reunião (reação, mão levantada)? */
export function isEventSource(source: TranscriptEntry['source']): boolean {
  return source.endsWith('-event');
}

/** Classifica a entrada para export/JSON. */
export function entryKind(source: TranscriptEntry['source']): 'speech' | 'chat' | 'event' {
  if (isChatSource(source)) return 'chat';
  if (isEventSource(source)) return 'event';
  return 'speech';
}

export type MeetingSession = {
  id: string;
  /** Plataforma onde a reunião foi capturada. Default 'google-meet' (compat. com dados antigos). */
  provider: MeetingProvider;
  meetingCode: string;
  meetingUrl: string;
  meetingTitle?: string;
  captureStartedAt?: string;
  captureEndedAt?: string;
  participants: Participant[];
  transcript: TranscriptEntry[];
};

export type UserSettings = {
  /** Idioma da UI/exportações/IA. undefined → detecta do navegador no primeiro uso. */
  locale?: Locale;
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
  /** Vocabulário do negócio: termos (empresas/produtos/siglas) injetados nos prompts de IA
   *  para corrigir palavras mal-transcritas pelo Google (ex.: "acme corp" → "AcmeCorp"). */
  vocabulary: string[];

  // ---- Alertas de menção (avisar quando falarem comigo / de um assunto) ----
  /** "Monitorar a reunião": liga o monitoramento de menções (toggle mestre). */
  alertsArmed: boolean;
  /** Toca um bipe na aba do Meet ao disparar. */
  alertSound: boolean;
  /** Seu nome na reunião — usado para ignorar suas próprias falas (não autoalerta). */
  selfName: string;
  /** Regras monitoradas (palavra/frase ou contexto via IA). */
  alertWatches: AlertWatch[];
};

/** Tipo de regra de alerta. */
export type AlertMode = 'keyword' | 'ai';

/** Uma regra monitorada: palavra/frase (keyword) ou contexto por IA (ai). */
export type AlertWatch = {
  id: string;
  mode: AlertMode;
  label: string;
  /** keyword: termos que disparam (qualquer um). */
  terms?: string[];
  /** ai: descrição em linguagem natural do que a IA deve vigiar. */
  desc?: string;
  enabled: boolean;
};

/** Uma detecção disparada (runtime — overlay + histórico, não persiste). */
export type AlertDetection = {
  key: string;
  mode: AlertMode;
  /** rótulo da regra que disparou. */
  label: string;
  /** motivo curto exibido em destaque (ex.: 'Mencionaram "Ana"'). */
  reason: string;
  /** quem falou. */
  who: string;
  /** trecho da fala. */
  text: string;
  /** horário (HH:MM). */
  t: string;
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
  vocabulary: [],
  alertsArmed: false,
  alertSound: true,
  selfName: '',
  alertWatches: [
    { id: 'w-name', mode: 'keyword', label: 'Menção ao seu nome', terms: [], enabled: true },
    {
      id: 'w-shared',
      mode: 'ai',
      label: 'Falaram do que você compartilhou',
      desc: 'Detecta quando citam a tela, planilha ou documento que você apresentou.',
      enabled: false,
    },
    {
      id: 'w-decision',
      mode: 'ai',
      label: 'Pediram uma decisão ou ação sua',
      desc: 'Avisa quando o contexto indica que esperam uma resposta ou aprovação sua.',
      enabled: false,
    },
  ],
};
