// Detecção da reunião do Google Meet (RF-006/007/009).
// O Meet é uma SPA: a URL muda sem reload e a UI de chamada aparece/some dinamicamente.
// Concentramos aqui os sinais de "entrou" / "saiu" e a extração de metadados da reunião.

/** Seletores/landmarks isolados — ajustar aqui se o Meet mudar (RNF-021/022). */
const SELECTORS = {
  // Botão de sair da chamada — presente apenas dentro da reunião, não no lobby.
  leaveButton: [
    'button[aria-label*="Sair da chamada" i]',
    'button[aria-label*="Leave call" i]',
    '[aria-label*="Sair da chamada" i]',
    '[aria-label*="Leave call" i]',
  ],
};

/** Código no formato xxx-xxxx-xxx no path da URL. */
const MEETING_CODE_RE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;

export type MeetingMeta = {
  meetingCode: string;
  meetingUrl: string;
  meetingTitle?: string;
};

export type DetectorCallbacks = {
  onJoined: (meta: MeetingMeta) => void;
  onLeft: () => void;
};

function queryAny(selectors: string[]): Element | null {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

export function getMeetingMeta(): MeetingMeta {
  const url = location.href;
  const path = location.pathname.replace(/^\//, '').split('/')[0] ?? '';
  const meetingCode = MEETING_CODE_RE.test(path) ? path : '';
  // Título: o Meet costuma refletir o nome da reunião no document.title quando há um.
  const rawTitle = document.title?.replace(/\s*[-–]\s*Google Meet\s*$/i, '').trim();
  const meetingTitle = rawTitle && !/^meet(\.google\.com)?$/i.test(rawTitle) ? rawTitle : undefined;
  return {
    meetingCode,
    meetingUrl: meetingCode ? `https://meet.google.com/${meetingCode}` : url,
    meetingTitle,
  };
}

export function isInMeeting(): boolean {
  return queryAny(SELECTORS.leaveButton) !== null;
}

/**
 * Carência antes de declarar "saiu": o Meet remove o botão de sair por instantes ao re-renderizar
 * (fullscreen, troca de layout, apresentação). Sem isto, um sumiço transiente vira onLeft+onJoined
 * e o onJoined zera a transcrição — perdendo o começo da reunião. RF-009.
 */
const LEAVE_GRACE_MS = 6000;

export class MeetDetector {
  private observer: MutationObserver | null = null;
  private joined = false;
  private currentCode = '';
  private pollId: number | null = null;
  /** timestamp (ms) do primeiro "fora da reunião" enquanto ainda joined; 0 = presente. */
  private absentSince = 0;

  constructor(private cb: DetectorCallbacks) {}

  start() {
    this.patchHistory();
    window.addEventListener('popstate', this.onUrlMaybeChanged);
    window.addEventListener('meetsync:locationchange', this.onUrlMaybeChanged);

    this.observer = new MutationObserver(() => this.evaluate());
    this.observer.observe(document.documentElement, { childList: true, subtree: true });

    // Fallback de baixa frequência para casos em que o observer não dispara.
    this.pollId = window.setInterval(() => this.evaluate(), 2000);
    this.evaluate();
  }

  stop() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.pollId !== null) clearInterval(this.pollId);
    window.removeEventListener('popstate', this.onUrlMaybeChanged);
    window.removeEventListener('meetsync:locationchange', this.onUrlMaybeChanged);
  }

  private onUrlMaybeChanged = () => this.evaluate();

  private evaluate() {
    const inMeeting = isInMeeting();
    const meta = getMeetingMeta();

    if (inMeeting) {
      this.absentSince = 0; // presença confirmada — cancela carência de saída
      const code = meta.meetingCode;
      if (!this.joined) {
        this.joined = true;
        this.currentCode = code;
        this.cb.onJoined(meta);
      } else if (code && code !== this.currentCode) {
        // Troca REAL de reunião (código novo e não vazio) conta como sair + entrar (RF-009).
        this.cb.onLeft();
        this.currentCode = code;
        this.cb.onJoined(meta);
      }
      // code vazio (regex falhou num tick) com sessão ativa: ignora, mantém currentCode.
    } else if (this.joined) {
      // Não declara saída de imediato: o botão de sair some por instantes em re-renders do Meet.
      if (this.absentSince === 0) {
        this.absentSince = Date.now();
      } else if (Date.now() - this.absentSince >= LEAVE_GRACE_MS) {
        this.joined = false;
        this.currentCode = '';
        this.absentSince = 0;
        this.cb.onLeft();
      }
    }
  }

  /** Emite evento custom em pushState/replaceState para detectar navegação SPA. */
  private patchHistory() {
    if ((window as unknown as { __meetsyncHistoryPatched?: boolean }).__meetsyncHistoryPatched) return;
    (window as unknown as { __meetsyncHistoryPatched?: boolean }).__meetsyncHistoryPatched = true;
    const fire = () => window.dispatchEvent(new Event('meetsync:locationchange'));
    for (const m of ['pushState', 'replaceState'] as const) {
      const orig = history[m];
      history[m] = function (this: History, ...args: Parameters<History['pushState']>) {
        const ret = orig.apply(this, args);
        fire();
        return ret;
      } as History[typeof m];
    }
  }
}
