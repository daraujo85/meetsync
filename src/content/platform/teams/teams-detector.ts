// Detecção de reunião no Microsoft Teams (Web). Sinal de "em reunião" = botão de sair
// (#hangup-button). SPA: usamos poll + carência antes de declarar "saiu" (igual ao Meet).
//
// >>> AJUSTE AQUI se o DOM do Teams mudar <<<
import type { MeetingDetector, PlatformDetectorCallbacks, PlatformMeetingMeta } from '../types';

const HANGUP_SELECTORS = ['#hangup-button', 'button[data-tid="hangup-main-btn"]'];

function inMeeting(): boolean {
  return HANGUP_SELECTORS.some((s) => {
    try {
      return document.querySelector(s) != null;
    } catch {
      return false;
    }
  });
}

export function getTeamsMeetingMeta(): PlatformMeetingMeta {
  const url = location.href;
  let code = '';
  const m = url.match(/\/meet\/(\d+)/);
  if (m) code = m[1]!;
  else {
    // A experiência "light-meetings/launch" carrega o meetingCode em base64 no param `coords`.
    try {
      const coords = new URL(url).searchParams.get('coords');
      if (coords) {
        const j = JSON.parse(atob(decodeURIComponent(coords))) as { meetingCode?: string };
        if (j.meetingCode) code = String(j.meetingCode);
      }
    } catch {
      /* ignora */
    }
  }
  // document.title costuma vir com lixo ("Meeting join | Reunião do Microsoft Teams",
  // "(2) Calendar | ...", "Chat | ..."). Pega o 1º segmento que pareça um título real.
  const JUNK = /microsoft teams|reunião do microsoft|teams meeting|^calendar$|^chat$|^\(?\d+\)?\s*calendar$|^meeting join$|^ingressar/i;
  const parts = (document.title || '').split('|').map((s) => s.trim()).filter(Boolean);
  const title = parts.find((p) => p.length > 1 && !JUNK.test(p));

  return { provider: 'microsoft-teams', meetingCode: code, meetingUrl: url, meetingTitle: title };
}

const LEAVE_GRACE_MS = 6000;

export class TeamsDetector implements MeetingDetector {
  private cb: PlatformDetectorCallbacks;
  private pollId: number | null = null;
  private joined = false;
  private absentSince = 0;

  constructor(cb: PlatformDetectorCallbacks) {
    this.cb = cb;
  }

  start() {
    if (this.pollId !== null) return;
    this.pollId = window.setInterval(() => this.tick(), 1500);
    this.tick();
  }

  stop() {
    if (this.pollId !== null) clearInterval(this.pollId);
    this.pollId = null;
  }

  private tick() {
    const present = inMeeting();
    if (present) {
      this.absentSince = 0;
      if (!this.joined) {
        this.joined = true;
        this.cb.onJoined(getTeamsMeetingMeta());
      }
    } else if (this.joined) {
      // Carência: o Teams remove/re-renderiza a barra ao trocar de layout — evita saída espúria.
      if (this.absentSince === 0) this.absentSince = Date.now();
      else if (Date.now() - this.absentSince >= LEAVE_GRACE_MS) {
        this.joined = false;
        this.absentSince = 0;
        this.cb.onLeft();
      }
    }
  }
}
