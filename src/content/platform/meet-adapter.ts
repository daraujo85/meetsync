// Adapter do Google Meet — embrulha os módulos existentes (comportamento inalterado).
import { MeetDetector } from '../meet-detector';
import { CaptionCapture } from '../caption-capture';
import { ChatCapture } from '../chat-capture';
import { MeetEventsCapture } from './meet/meet-events-capture';
import type {
  PlatformAdapter,
  PlatformDetectorCallbacks,
  MeetingDetector,
  CaptionController,
  ChatController,
} from './types';

export class MeetAdapter implements PlatformAdapter {
  provider = 'google-meet' as const;

  createDetector(cb: PlatformDetectorCallbacks): MeetingDetector {
    // O MeetDetector emite meta sem `provider`; injetamos aqui.
    return new MeetDetector({
      onJoined: (m) => cb.onJoined({ provider: 'google-meet', ...m }),
      onLeft: cb.onLeft,
    });
  }

  createCaptionCapture(): CaptionController {
    return new CaptionCapture();
  }

  createChatCapture(): ChatController {
    return new ChatCapture();
  }

  createEventsCapture(): ChatController {
    return new MeetEventsCapture();
  }
}
