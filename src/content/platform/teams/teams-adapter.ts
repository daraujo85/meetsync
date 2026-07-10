// Adapter do Microsoft Teams (Web).
import { TeamsDetector } from './teams-detector';
import { TeamsCaptionCapture } from './teams-caption-capture';
import { TeamsChatCapture } from './teams-chat-capture';
import { TeamsEventsCapture } from './teams-events-capture';
import type {
  PlatformAdapter,
  PlatformDetectorCallbacks,
  MeetingDetector,
  CaptionController,
  ChatController,
} from '../types';

export class TeamsAdapter implements PlatformAdapter {
  provider = 'microsoft-teams' as const;

  // No Teams o idioma FALADO da legenda é escolhido pelo usuário e vale para a reunião inteira;
  // o padrão costuma vir em inglês e quebra a transcrição de falas em português. Orientamos o
  // usuário a conferir (a extensão não altera a config da reunião).
  captionLanguageHint =
    'Legendas do Teams: confira o idioma falado (barra de legendas → ⚙️ → Configurações de idioma) — o padrão pode vir em inglês.';

  createDetector(cb: PlatformDetectorCallbacks): MeetingDetector {
    return new TeamsDetector(cb);
  }

  createCaptionCapture(): CaptionController {
    return new TeamsCaptionCapture();
  }

  createChatCapture(): ChatController {
    return new TeamsChatCapture();
  }

  createEventsCapture(): ChatController {
    return new TeamsEventsCapture();
  }
}
