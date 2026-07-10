// Abstração de plataforma de reunião. O núcleo (store/UI/export/Ollama/alertas) é agnóstico:
// cada plataforma (Google Meet, Microsoft Teams) fornece um detector + captura de legenda + chat
// que alimentam a mesma store. Assim, exportação, resumo, Q&A etc. funcionam igual em qualquer uma.

import type { MeetingProvider } from '@/types';

export type PlatformMeetingMeta = {
  provider: MeetingProvider;
  meetingCode: string;
  meetingUrl: string;
  meetingTitle?: string;
};

export type PlatformDetectorCallbacks = {
  onJoined: (meta: PlatformMeetingMeta) => void;
  onLeft: () => void;
};

/** Detecta entrada/saída de reunião (SPA). */
export interface MeetingDetector {
  start(): void;
  stop(): void;
}

/** Captura de legendas: liga automaticamente e observa o container. */
export interface CaptionController {
  start(): void;
  stop(): void;
  /** Alterna as legendas da plataforma (botão CC do MeetSync). */
  toggleCaptions(): void;
  /** Tenta ligar as legendas automaticamente. Retorna true se já on / tentou. */
  tryEnableCaptions(): boolean;
}

/** Captura das mensagens do chat da reunião. */
export interface ChatController {
  start(): void;
  stop(): void;
}

export interface PlatformAdapter {
  provider: MeetingProvider;
  createDetector(cb: PlatformDetectorCallbacks): MeetingDetector;
  createCaptionCapture(): CaptionController;
  createChatCapture(): ChatController;
  /** Captura opcional de presença/eventos (participantes, mão levantada, reações). */
  createEventsCapture?(): ChatController;
  /** Dica única a exibir ao usuário ao entrar (ex.: conferir idioma da legenda no Teams). */
  captionLanguageHint?: string;
}
