// UI do MeetSync: barra compacta (§10.1) + painel expandido (§10.2). Vanilla TS, dentro do
// Shadow DOM. Assina o `store` e atualiza o DOM. Estrutura segue o mockup (HANDOFF §3):
// header · status strip · tabs (Transcrição/Resumo/Exportar/Upload) · conteúdo · footer.

import { el } from './dom';
import { icons } from './icons';
import { logoImg } from './logo';
import { store, cryptoRandomId, type AppState } from '@/services/store';
import type { AlertDetection, AlertMode } from '@/types';
import {
  loadHistory,
  loadMeeting,
  deleteMeeting,
  setMeetingStarred,
  type HistoryMeta,
} from '@/services/storage-service';
import {
  buildTxt,
  buildSummaryTxt,
  buildFilename,
  buildHeader,
  buildMeetingJson,
  downloadText,
  formatTime,
} from '@/services/export-txt';
import { correctTranscript, summarizeMeeting, summarizeMeetingStream } from '@/services/summary-service';
import { ollama, normalizeOllamaUrl } from '@/services/ollama-client';
import { initials } from '@/content/participant-resolver';

export type PanelController = {
  /** Liga/desliga as legendas do Meet (botão CC). */
  toggleCaptions: () => void;
  /** Dispara um alerta de teste a partir de uma regra ("Simular detecção"). */
  simulateAlert: (detection: AlertDetection) => void;
};

type TabId = 'transcript' | 'summary' | 'alerts' | 'export' | 'upload';
const TABS: Array<{ id: TabId; label: string; beta?: boolean }> = [
  { id: 'transcript', label: 'Transcrição' },
  { id: 'alerts', label: 'Alertas' },
  { id: 'summary', label: 'Resumo' },
  { id: 'export', label: 'Exportar' },
  { id: 'upload', label: 'Upload', beta: true },
];

const INTERVALS = [1, 2, 5, 10]; // minutos

// Paleta de avatares (sem verde — PRD §8.2.5). Cor estável por nome.
const AVATAR_COLORS = ['#4E8FC7', '#A064B5', '#C2734A', '#5B8DB8', '#B5687F', '#7E7BD0', '#C7913F'];
function avatarColor(name: string): string {
  if (/^você$/i.test(name.trim())) return '#5F6368';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

// ---- helpers do histórico ----
const MONTHS_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function fmtFullDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const wd = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const date = d.toLocaleDateString('pt-BR');
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${date}`;
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}min`;
}

/** Pilha de avatares sobrepostos (com "+N" se exceder). */
function avatarStack(names: string[], max = 4): HTMLElement {
  const wrap = el('div', { class: 'ms-avstack' });
  const shown = names.slice(0, max);
  shown.forEach((name, i) => {
    const av = el('span', { class: 'ms-avstack-av', text: initials(name) });
    av.style.background = avatarColor(name);
    if (i > 0) av.style.marginLeft = '-8px';
    wrap.append(av);
  });
  const extra = names.length - shown.length;
  if (extra > 0) {
    const more = el('span', { class: 'ms-avstack-av ms-avstack-more', text: `+${extra}` });
    if (shown.length) more.style.marginLeft = '-8px';
    wrap.append(more);
  }
  return wrap;
}

/** Chip de metadado (ícone + texto), tom acento opcional. */
function metaChip(iconHtml: string, text: string, accent = false): HTMLElement {
  return el('span', { class: 'ms-metachip' + (accent ? ' is-accent' : '') }, [
    el('span', { class: 'ms-metachip-ico', html: iconHtml }),
    el('span', { text }),
  ]);
}

// ---------- helpers de status (ponto + texto, tons rec/paused/active/busy/error/idle) ----------
type Tone = 'rec' | 'paused' | 'active' | 'busy' | 'error' | 'idle';
// Idempotente: só recria o ícone quando o tom muda (não reinicia a animação a cada update).
function statusInto(container: HTMLElement, tone: Tone, text: string) {
  if (container.dataset.tone !== tone || container.childElementCount !== 2) {
    container.dataset.tone = tone;
    const icon = tone === 'busy' ? el('span', { class: 'ms-spinner' }) : el('span', { class: 'ms-status-dot' });
    container.replaceChildren(icon, el('span', { text }));
  } else {
    const txt = container.lastElementChild;
    if (txt && txt.textContent !== text) txt.textContent = text;
  }
  const cls = `ms-status is-${tone}`;
  if (container.className !== cls) container.className = cls;
}

// ---------- toggle ----------
function makeToggle(onChange: (on: boolean) => void) {
  const knob = el('span', { class: 'ms-knob' });
  const sw = el('button', { class: 'ms-toggle', type: 'button', role: 'switch', 'aria-checked': 'false' }, [knob]) as HTMLButtonElement;
  let on = false;
  let disabled = false;
  sw.addEventListener('click', () => {
    if (disabled) return;
    on = !on;
    render();
    onChange(on);
  });
  function render() {
    sw.classList.toggle('is-on', on);
    sw.setAttribute('aria-checked', String(on));
    sw.disabled = disabled;
  }
  return {
    el: sw,
    setOn(v: boolean) { on = v; render(); },
    setDisabled(v: boolean) { disabled = v; render(); },
    get value() { return on; },
  };
}

function toggleRow(opts: { label: string; desc?: string; onChange: (on: boolean) => void }) {
  const tg = makeToggle(opts.onChange);
  const note = el('div', { class: 'ms-toggle-note ms-hidden' });
  const labels = el('div', { class: 'ms-toggle-labels' }, [
    el('div', { class: 'ms-toggle-main', text: opts.label }),
    ...(opts.desc ? [el('div', { class: 'ms-toggle-help', text: opts.desc })] : []),
    note,
  ]);
  const root = el('div', { class: 'ms-toggle-row' }, [labels, tg.el]);
  return {
    root,
    setOn: (v: boolean) => tg.setOn(v),
    setDisabled: (v: boolean) => { tg.setDisabled(v); root.classList.toggle('is-disabled', v); },
    setNote: (text: string | null) => {
      note.classList.toggle('ms-hidden', !text);
      if (text) note.replaceChildren(el('span', { class: 'ms-note-ico', html: icons.info }), el('span', { text }));
    },
    get value() { return tg.value; },
  };
}

// ---------- markdown leve (resumo) ----------
function appendInline(parent: HTMLElement, text: string) {
  text.split(/\*\*(.+?)\*\*/g).forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 1) parent.append(el('strong', { text: part }));
    else parent.append(document.createTextNode(part));
  });
}
// Transforma URLs em links clicáveis (abrem em nova aba). Constrói via DOM (sem innerHTML).
function linkify(container: HTMLElement, text: string) {
  container.replaceChildren();
  const re = /(https?:\/\/[^\s]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) container.append(document.createTextNode(text.slice(last, m.index)));
    container.append(el('a', { class: 'ms-link', href: m[0], target: '_blank', rel: 'noopener noreferrer', text: m[0] }));
    last = m.index + m[0].length;
  }
  if (last < text.length) container.append(document.createTextNode(text.slice(last)));
}

function renderMarkdownInto(container: HTMLElement, text: string, cursor = false) {
  container.replaceChildren();
  let list: HTMLElement | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { list = null; continue; }
    // bullets
    if (/^[-*]\s+/.test(line)) {
      if (!list) { list = el('ul', { class: 'ms-sum-list' }); container.append(list); }
      const li = el('li', {});
      appendInline(li, line.replace(/^[-*]\s+/, ''));
      list.append(li);
      continue;
    }
    list = null;
    // "N. texto" (com ou sem ##) → item numerado, com negrito inline preservado
    const numbered = line.match(/^(?:#{1,6}\s+)?(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      const item = el('div', { class: 'ms-sum-numitem' }, [el('span', { class: 'ms-sum-num', text: numbered[1]! })]);
      const t = el('span', { class: 'ms-sum-numitem-text' });
      appendInline(t, numbered[2]!);
      item.append(t);
      container.append(item);
      continue;
    }
    // "## Título" ou "**Título**" → rótulo de seção
    const heading = line.match(/^(?:#{1,6}\s+)?\*\*(.+?)\*\*:?\s*$/) || line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      container.append(el('div', { class: 'ms-sum-h', text: heading[1]!.replace(/:$/, '') }));
      continue;
    }
    const p = el('div', { class: 'ms-sum-p' });
    appendInline(p, line);
    container.append(p);
  }
  if (cursor) container.append(el('span', { class: 'ms-cursor' }));
}

export class Panel {
  private unsub: (() => void) | null = null;
  private chatNodes = new Map<string, { row: HTMLElement; text: HTMLElement; time: HTMLElement }>();
  private autoScroll = true;

  // refs
  private compact!: HTMLElement;
  private panel!: HTMLElement;
  private ccBtn!: HTMLButtonElement;
  private compactDot!: HTMLElement;
  private compactDotLabel!: HTMLElement;
  private lastDotKind = '';
  private panelHeader!: HTMLElement;
  private aboutSheet!: HTMLElement;
  // histórico de reuniões
  private historySheet!: HTMLElement;
  private histListView!: HTMLElement;
  private histDetailView!: HTMLElement;
  private histList!: HTMLElement;
  private histCount!: HTMLElement;
  private histSearch!: HTMLInputElement;
  private histMetas: HistoryMeta[] = [];
  private histQuery = '';
  private lastHistoryOpen = false;

  private stripStatus!: HTMLElement;
  private captionsToggle!: ReturnType<typeof makeToggle>;

  private tabBtns = new Map<TabId, HTMLButtonElement>();
  private tabPanels = new Map<TabId, HTMLElement>();

  // transcript
  private chatList!: HTMLElement;
  private transcriptScroll!: HTMLElement;
  private tailStatus!: HTMLElement;
  private jumpBtn!: HTMLButtonElement;

  // summary
  private rtToggle!: ReturnType<typeof makeToggle>;
  private intervalPills!: HTMLElement;
  private summaryStatus!: HTMLElement;
  private summaryContent!: HTMLElement;
  private renderedSummary = '';

  // alerts (menções) — modelo de regras do mockup
  private tgArmed!: ReturnType<typeof makeToggle>;
  private tgSound!: ReturnType<typeof makeToggle>;
  private armCard!: HTMLElement;
  private armIcon!: HTMLElement;
  private armSub!: HTMLElement;
  private soundRow!: HTMLElement;
  private watchesWrap!: HTMLElement;
  private addInput!: HTMLInputElement;
  private addHelp!: HTMLElement;
  private addMode: AlertMode = 'keyword';
  private addSegBtns = new Map<AlertMode, HTMLButtonElement>();
  private recentSection!: HTMLElement;
  private recentWrap!: HTMLElement;
  private alertsTabBadge: HTMLElement | null = null;
  private lastWatchSig = '';
  private lastRecentSig = '';
  // overlay (banner)
  private alertOverlay!: HTMLElement;
  private ovBell!: HTMLElement;
  private ovEyebrow!: HTMLElement;
  private ovReason!: HTMLElement;
  private ovAvatar!: HTMLElement;
  private ovWho!: HTMLElement;
  private ovTime!: HTMLElement;
  private ovText!: HTMLElement;
  private lastOvKey = '';
  // sininho da barra compacta
  private bellBtn!: HTMLButtonElement;
  private bellIcon!: HTMLElement;
  private bellBadge!: HTMLElement;

  // export
  private tgAutoStart!: ReturnType<typeof toggleRow>;
  private tgAutoChat!: ReturnType<typeof toggleRow>;
  private tgHeader!: ReturnType<typeof toggleRow>;
  private tgCorrect!: ReturnType<typeof toggleRow>;
  private tgSummary!: ReturnType<typeof toggleRow>;
  private tgSeparate!: ReturnType<typeof toggleRow>;
  private tgJson!: ReturnType<typeof toggleRow>;
  private selfNameInput!: HTMLInputElement;
  // vocabulário do negócio
  private vocabWrap!: HTMLElement;
  private vocabInput!: HTMLInputElement;
  private vocabNote!: HTMLElement;
  private lastVocabSig = ' ';
  private ollamaUrlInput!: HTMLInputElement;
  private modelPills!: HTMLElement;
  private ollamaStatusEl!: HTMLElement;
  private preview!: HTMLElement;
  private previewName!: HTMLElement;
  private previewMode: 'txt' | 'ata' = 'txt';
  private previewBtns = new Map<'txt' | 'ata', HTMLButtonElement>();

  // footer
  private footer!: HTMLElement;
  private downloadBtn!: HTMLButtonElement;
  private downloadRawBtn!: HTMLButtonElement;
  private busy = false;
  /** Impede que a aba navegue (ex.: Meet volta à tela inicial ao encerrar) enquanto a IA processa
   *  e o download ainda não disparou — senão o arquivo é perdido. */
  private unloadGuard = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };

  // realtime scheduler
  private rtTimer: number | null = null;
  private rtUiTimer: number | null = null;
  private lastRtSig = '';
  private nextRtAt = 0;
  private rtTimerIntervalMs = 0;

  // drag
  private dragOffset = { x: 0, y: 0 };

  constructor(private controller: PanelController) {}

  mount(root: ShadowRoot) {
    const container = el('div', { class: 'ms-root' });
    container.append(this.buildCompact(), this.buildPanel(), this.buildAlertOverlay());
    root.append(container);

    this.unsub = store.subscribe((s) => this.update(s));

    void this.loadOffset();
    this.enableDrag(this.compact.querySelector('.ms-logo') as HTMLElement);
    this.enableDrag(this.panelHeader);

    this.rtUiTimer = window.setInterval(() => this.rtUiTick(), 1000);
    if (store.get().settings.ollamaUrl) void this.testOllama();
  }

  destroy() {
    this.unsub?.();
    if (this.rtTimer !== null) clearInterval(this.rtTimer);
    if (this.rtUiTimer !== null) clearInterval(this.rtUiTimer);
    this.rtTimer = null;
    this.rtUiTimer = null;
  }

  // ================= Barra compacta =================
  private buildCompact(): HTMLElement {
    const logo = el('div', { class: 'ms-logo', title: 'MeetSync · arraste para mover' }, [logoImg(34)]);

    const expandBtn = el('button', { class: 'ms-icon-btn', title: 'Abrir painel MeetSync', 'aria-label': 'Abrir painel', html: icons.expand });
    expandBtn.addEventListener('click', () => store.patchUi({ expanded: true }));

    this.ccBtn = el('button', { class: 'ms-icon-btn', title: 'Ligar/desligar legendas', 'aria-label': 'Legendas', html: icons.captions }) as HTMLButtonElement;
    this.ccBtn.addEventListener('click', () => this.controller.toggleCaptions());

    const dlBtn = el('button', { class: 'ms-icon-btn', title: 'Baixar transcrição (.txt)', 'aria-label': 'Baixar', html: icons.download });
    dlBtn.addEventListener('click', () => this.quickDownload());

    // Sininho de alertas (abre a aba Alertas; mostra estado de arme + não-lidos).
    this.bellIcon = el('span', { class: 'ms-bell-ico', html: icons.ear });
    this.bellBadge = el('span', { class: 'ms-bell-badge ms-hidden' });
    this.bellBtn = el('button', { class: 'ms-icon-btn ms-bell-btn', title: 'Alertas de menção', 'aria-label': 'Alertas' }, [this.bellIcon, this.bellBadge]) as HTMLButtonElement;
    this.bellBtn.addEventListener('click', () => { store.patchUi({ expanded: true, activeTab: 'alerts' }); store.clearAlertUnread(); });

    this.compactDot = el('span', { class: 'ms-dot' });
    this.compactDotLabel = el('span', { text: 'Pausado' });
    const dot = el('div', { class: 'ms-capture-dot' }, [this.compactDot, this.compactDotLabel]);

    this.compact = el('div', { class: 'ms-compact' }, [logo, expandBtn, this.ccBtn, dlBtn, this.bellBtn, el('div', { class: 'ms-divider' }), dot]);
    return this.compact;
  }

  // ================= Painel expandido =================
  private buildPanel(): HTMLElement {
    const header = this.buildHeader();
    const strip = this.buildStatusStrip();
    const tabs = this.buildTabs();

    const body = el('div', { class: 'ms-body' }, [
      this.buildTranscriptTab(),
      this.buildSummaryTab(),
      this.buildAlertsTab(),
      this.buildExportTab(),
      this.buildUploadTab(),
    ]);

    this.aboutSheet = this.buildAbout();
    this.historySheet = this.buildHistorySheet();
    this.panel = el('div', { class: 'ms-panel ms-hidden' }, [header, strip, tabs, body, this.buildFooter(), this.aboutSheet, this.historySheet]);
    return this.panel;
  }

  private buildHeader(): HTMLElement {
    const historyBtn = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', title: 'Histórico de reuniões', 'aria-label': 'Histórico de reuniões', html: icons.history });
    historyBtn.addEventListener('click', () => store.patchUi({ historyOpen: true }));
    const aboutBtn = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', title: 'Sobre o MeetSync', 'aria-label': 'Sobre', html: icons.info });
    aboutBtn.addEventListener('click', () => this.aboutSheet.classList.remove('ms-hidden'));
    const closeBtn = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', title: 'Recolher painel', 'aria-label': 'Recolher', html: icons.collapse });
    closeBtn.addEventListener('click', () => store.patchUi({ expanded: false }));

    const header = el('div', { class: 'ms-header' }, [
      el('span', { class: 'ms-header-logo' }, [logoImg(26)]),
      el('span', { class: 'ms-wordmark' }, [el('span', { class: 'ms-wm-meet', text: 'Meet' }), el('span', { class: 'ms-wm-sync', text: 'Sync' })]),
      el('span', { class: 'ms-badge', text: 'Beta' }),
      el('div', { class: 'ms-spacer' }),
      historyBtn,
      aboutBtn,
      closeBtn,
    ]);
    this.panelHeader = header;
    return header;
  }

  private buildStatusStrip(): HTMLElement {
    this.stripStatus = el('span', { class: 'ms-status is-paused' });
    this.captionsToggle = makeToggle(() => this.controller.toggleCaptions());
    return el('div', { class: 'ms-status-strip' }, [
      this.stripStatus,
      el('div', { class: 'ms-strip-right' }, [el('span', { class: 'ms-strip-label', text: 'Legendas' }), this.captionsToggle.el]),
    ]);
  }

  private buildTabs(): HTMLElement {
    const tabs = el('div', { class: 'ms-tabs' });
    for (const t of TABS) {
      const btn = el('button', { class: 'ms-tab', type: 'button' }, [el('span', { text: t.label })]) as HTMLButtonElement;
      if (t.beta) btn.append(el('span', { class: 'ms-tab-beta', text: 'beta' }));
      if (t.id === 'alerts') {
        this.alertsTabBadge = el('span', { class: 'ms-tab-count ms-hidden' });
        btn.append(this.alertsTabBadge);
      }
      btn.append(el('span', { class: 'ms-tab-underline' }));
      btn.addEventListener('click', () => store.patchUi({ activeTab: t.id }));
      this.tabBtns.set(t.id, btn);
      tabs.append(btn);
    }
    return tabs;
  }

  // ---------- aba Transcrição ----------
  private buildTranscriptTab(): HTMLElement {
    this.chatList = el('div', { class: 'ms-chat' }, [
      el('div', { class: 'ms-chat-empty', text: 'Nenhuma fala capturada ainda. Ative as legendas do Meet para começar.' }),
    ]);
    this.tailStatus = el('span', { class: 'ms-status is-paused' });
    const scroll = el('div', { class: 'ms-tabpanel ms-scroll' }, [this.chatList, el('div', { class: 'ms-tail' }, [this.tailStatus])]);
    scroll.addEventListener('scroll', () => {
      const atBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 50;
      this.autoScroll = atBottom;
      this.jumpBtn.classList.toggle('ms-hidden', atBottom);
    });
    this.transcriptScroll = scroll;

    this.jumpBtn = el('button', { class: 'ms-jump ms-hidden', type: 'button' }, [el('span', { html: icons.download }), el('span', { text: 'Ir para o fim' })]) as HTMLButtonElement;
    this.jumpBtn.addEventListener('click', () => { scroll.scrollTop = scroll.scrollHeight; this.autoScroll = true; this.jumpBtn.classList.add('ms-hidden'); });

    const wrap = el('div', { class: 'ms-tabwrap' }, [scroll, this.jumpBtn]);
    this.tabPanels.set('transcript', wrap);
    return wrap;
  }

  // ---------- aba Resumo ----------
  private buildSummaryTab(): HTMLElement {
    this.rtToggle = makeToggle((v) => {
      void store.updateSettings({ realtimeSummary: v });
      if (v) this.lastRtSig = '';
      this.renderIntervalPills(store.get());
    });
    this.intervalPills = el('div', { class: 'ms-pill-group' });
    const rtBar = el('div', { class: 'ms-rt-bar' }, [
      el('div', { class: 'ms-rt-head' }, [
        el('div', { class: 'ms-toggle-labels' }, [
          el('div', { class: 'ms-toggle-main', text: 'Resumo em tempo real' }),
          el('div', { class: 'ms-toggle-help', text: 'Atualiza a ata automaticamente, via streaming do Ollama.' }),
        ]),
        this.rtToggle.el,
      ]),
      el('div', { class: 'ms-rt-interval' }, [
        el('span', { class: 'ms-label', text: 'Atualizar a cada' }),
        this.intervalPills,
        el('span', { class: 'ms-label', text: 'min' }),
      ]),
    ]);

    this.summaryStatus = el('div', { class: 'ms-sum-status ms-hidden' });
    this.summaryContent = el('div', { class: 'ms-summary' });
    const scroll = el('div', { class: 'ms-tabpanel ms-scroll' }, [this.summaryStatus, this.summaryContent]);

    const wrap = el('div', { class: 'ms-tabwrap' }, [rtBar, scroll]);
    this.tabPanels.set('summary', wrap);
    return wrap;
  }

  private renderIntervalPills(s: AppState) {
    const wrap = this.intervalPills;
    wrap.replaceChildren(
      ...INTERVALS.map((m) => {
        const sel = s.settings.summaryIntervalMin === m;
        const b = el('button', { class: 'ms-pill' + (sel ? ' is-sel' : ''), type: 'button', text: String(m) }) as HTMLButtonElement;
        b.addEventListener('click', () => void store.updateSettings({ summaryIntervalMin: m }));
        return b;
      }),
    );
    this.intervalPills.parentElement?.classList.toggle('ms-hidden', !s.settings.realtimeSummary);
  }

  // ---------- aba Alertas (menções) ----------
  private buildAlertsTab(): HTMLElement {
    // Barra "Monitorar a reunião" (toggle mestre)
    this.tgArmed = makeToggle((v) => void store.updateSettings({ alertsArmed: v }));
    this.armIcon = el('span', { class: 'ms-arm-ico' });
    this.armSub = el('div', { class: 'ms-arm-sub' });
    this.armCard = el('div', { class: 'ms-arm' }, [
      this.armIcon,
      el('div', { class: 'ms-arm-text' }, [el('div', { class: 'ms-arm-title', text: 'Monitorar a reunião' }), this.armSub]),
      this.tgArmed.el,
    ]);

    // Som
    this.tgSound = makeToggle((v) => void store.updateSettings({ alertSound: v }));
    this.soundRow = el('div', { class: 'ms-sound-row' }, [el('span', { text: 'Tocar som ao alertar' }), this.tgSound.el]);

    // Lista de regras
    this.watchesWrap = el('div', { class: 'ms-watches' });

    // Adicionar expressão (segmented + input)
    const seg = el('div', { class: 'ms-alseg' });
    ([['keyword', 'Palavra / frase', 'quote'], ['ai', 'IA por contexto', 'sparkles']] as const).forEach(([m, label, icon]) => {
      const b = el('button', { class: 'ms-alseg-btn', type: 'button' }, [
        el('span', { class: 'ms-alseg-ico', html: icons[icon] }),
        el('span', { text: label }),
      ]) as HTMLButtonElement;
      b.addEventListener('click', () => { this.addMode = m; this.syncAddMode(); });
      this.addSegBtns.set(m, b);
      seg.append(b);
    });
    this.addInput = el('input', { class: 'ms-input', type: 'text', 'aria-label': 'Nova expressão' }) as HTMLInputElement;
    const addBtn = el('button', { class: 'ms-btn ms-btn-primary ms-btn-sm', type: 'button' }, [
      el('span', { class: 'ms-btn-ico', html: icons.plus }),
      el('span', { text: 'Adicionar' }),
    ]);
    const submit = () => {
      const v = this.addInput.value.trim();
      if (!v) return;
      const cur = store.get().settings.alertWatches;
      const watch = this.addMode === 'keyword'
        ? { id: cryptoRandomId(), mode: 'keyword' as const, label: 'Palavra ou frase', terms: v.split(',').map((t) => t.trim()).filter(Boolean), enabled: true }
        : { id: cryptoRandomId(), mode: 'ai' as const, label: 'Contexto monitorado', desc: v, enabled: true };
      void store.updateSettings({ alertWatches: [...cur, watch] });
      this.addInput.value = '';
    };
    addBtn.addEventListener('click', submit);
    this.addInput.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); submit(); } });
    this.addHelp = el('div', { class: 'ms-add-help' });

    // Detecções recentes
    this.recentWrap = el('div', { class: 'ms-recent' });
    this.recentSection = el('div', { class: 'ms-section ms-hidden' }, [this.sectionLabel('Detecções recentes', icons.clock), this.recentWrap]);

    this.syncAddMode();

    const scroll = el('div', { class: 'ms-tabpanel ms-scroll' }, [
      this.armCard,
      this.soundRow,
      el('div', { class: 'ms-section' }, [this.sectionLabel('Expressões monitoradas', icons.bell), this.watchesWrap]),
      el('div', { class: 'ms-section' }, [
        this.sectionLabel('Adicionar expressão', icons.plus),
        seg,
        el('div', { class: 'ms-row-gap ms-mt-2' }, [el('div', { class: 'ms-grow' }, [this.addInput]), addBtn]),
        this.addHelp,
      ]),
      this.recentSection,
    ]);
    this.tabPanels.set('alerts', scroll);
    return scroll;
  }

  private syncAddMode() {
    for (const [m, b] of this.addSegBtns) b.classList.toggle('is-sel', m === this.addMode);
    this.addInput.placeholder = this.addMode === 'keyword' ? 'ex.: meu nome, orçamento, prazo…' : 'ex.: quando pedirem uma decisão minha';
    this.addHelp.textContent = this.addMode === 'keyword'
      ? 'Dispara quando alguém (que não seja você) falar a palavra ou frase. Separe variações por vírgula.'
      : 'A IA observa o contexto em tempo real e dispara quando o sentido bater — não precisa ser a frase exata.';
  }

  private renderWatches(s: AppState) {
    const ws = s.settings.alertWatches;
    const aiReady = this.ollamaReady(s);
    const armed = s.settings.alertsArmed;
    const sig = JSON.stringify(ws.map((w) => [w.id, w.mode, w.label, w.enabled, (w.terms ?? []).join('|'), w.desc])) + `|${aiReady}|${armed}`;
    if (sig === this.lastWatchSig) return;
    this.lastWatchSig = sig;
    if (!ws.length) {
      this.watchesWrap.replaceChildren(el('div', { class: 'ms-watch-empty', text: 'Nenhuma expressão. Adicione abaixo.' }));
      return;
    }
    this.watchesWrap.replaceChildren(...ws.map((w, i) => this.watchRow(w, i, armed, aiReady)));
  }

  private watchRow(w: AppState['settings']['alertWatches'][number], i: number, armed: boolean, aiReady: boolean): HTMLElement {
    const ai = w.mode === 'ai';
    const blocked = ai && !aiReady;

    const iconBox = el('span', { class: 'ms-watch-ico' + (ai ? ' is-ai' : ''), html: icons[ai ? 'sparkles' : 'quote'] });
    const head = el('div', { class: 'ms-watch-label' }, [
      el('span', { text: w.label }),
      el('span', { class: 'ms-watch-badge', text: ai ? 'IA' : 'frase' }),
    ]);
    const body = ai
      ? el('div', { class: 'ms-watch-desc', text: w.desc ?? '' })
      : el('div', { class: 'ms-watch-terms' }, (w.terms && w.terms.length)
          ? w.terms.map((t) => el('span', { class: 'ms-term', text: t }))
          : [el('div', { class: 'ms-watch-desc', text: 'Sem termos ainda — adicione abaixo.' })]);
    const main: Array<Node> = [head, body];
    if (blocked) {
      main.push(el('div', { class: 'ms-watch-warn' }, [el('span', { class: 'ms-note-ico', html: icons.info }), el('span', { text: 'Requer Ollama configurado na aba Exportar.' })]));
    }
    const canSim = armed && !blocked && w.enabled;
    const sim = el('button', { class: 'ms-watch-sim' + (canSim ? '' : ' is-disabled'), type: 'button' }, [
      el('span', { class: 'ms-watch-sim-ico', html: icons.bellRing }),
      el('span', { text: 'Simular detecção' }),
    ]);
    if (canSim) sim.addEventListener('click', () => this.controller.simulateAlert(this.demoDetection(w)));
    main.push(sim);

    const tg = makeToggle((v) => void store.updateSettings({
      alertWatches: store.get().settings.alertWatches.map((x) => (x.id === w.id ? { ...x, enabled: v } : x)),
    }));
    tg.setOn(w.enabled);
    tg.setDisabled(blocked);
    const trash = el('button', { class: 'ms-watch-trash', type: 'button', 'aria-label': 'Remover', html: icons.trash });
    trash.addEventListener('click', () => void store.updateSettings({
      alertWatches: store.get().settings.alertWatches.filter((x) => x.id !== w.id),
    }));
    const right = el('div', { class: 'ms-watch-right' }, [tg.el, trash]);

    return el('div', { class: 'ms-watch' + (blocked ? ' is-blocked' : '') + (i > 0 ? ' has-sep' : '') }, [
      iconBox,
      el('div', { class: 'ms-watch-main' }, main),
      right,
    ]);
  }

  private demoDetection(w: AppState['settings']['alertWatches'][number]): AlertDetection {
    const term = w.terms && w.terms.length ? w.terms[0] : null;
    return {
      key: 'sim-' + w.id + '-' + Date.now(),
      mode: w.mode,
      label: w.label,
      reason: w.mode === 'keyword' ? `Mencionaram "${term ?? w.label}"` : `IA · ${w.label}`,
      who: 'Participante',
      text: w.mode === 'keyword'
        ? `…acho que precisamos olhar "${term ?? w.label}" com calma antes de decidir.`
        : '…isso depende de você, consegue confirmar até amanhã pra gente seguir?',
      t: 'agora',
    };
  }

  private renderRecent(s: AppState) {
    const r = s.alerts.recent;
    const sig = r.map((d) => d.key).join(',');
    if (sig === this.lastRecentSig) return;
    this.lastRecentSig = sig;
    this.recentSection.classList.toggle('ms-hidden', r.length === 0);
    this.recentWrap.replaceChildren(...r.map((d) => {
      const item = el('button', { class: 'ms-recent-item', type: 'button' }, [
        el('span', { class: 'ms-recent-ico', html: icons[d.mode === 'ai' ? 'sparkles' : 'bell'] }),
        el('span', { class: 'ms-recent-body' }, [
          el('span', { class: 'ms-recent-reason', text: d.reason }),
          el('span', { class: 'ms-recent-snip', text: d.who ? `${d.who}: "${d.text}"` : d.text }),
        ]),
        el('span', { class: 'ms-recent-t', text: d.t }),
      ]);
      item.addEventListener('click', () => { store.dismissActiveAlert(); store.clearAlertUnread(); });
      return item;
    }));
  }

  // ---------- Banner de alerta (overlay) ----------
  private buildAlertOverlay(): HTMLElement {
    this.ovBell = el('span', { class: 'ms-ov-bellico' });
    this.ovEyebrow = el('div', { class: 'ms-ov-eyebrow' });
    this.ovReason = el('div', { class: 'ms-ov-reason' });
    const closeBtn = el('button', { class: 'ms-ov-close', type: 'button', 'aria-label': 'Dispensar', html: icons.close });
    closeBtn.addEventListener('click', () => store.dismissActiveAlert());

    this.ovAvatar = el('span', { class: 'ms-ov-avatar' });
    this.ovWho = el('span', { class: 'ms-ov-who' });
    this.ovTime = el('span', { class: 'ms-ov-time' });
    this.ovText = el('div', { class: 'ms-ov-text' });

    const goBtn = el('button', { class: 'ms-btn ms-btn-primary ms-btn-block', type: 'button' }, [
      el('span', { class: 'ms-btn-ico', html: icons.video }),
      el('span', { text: 'Ir para a reunião' }),
    ]);
    goBtn.addEventListener('click', () => { store.dismissActiveAlert(); store.clearAlertUnread(); store.patchUi({ expanded: false }); });
    const dismissBtn = el('button', { class: 'ms-btn ms-btn-ghost', type: 'button', text: 'Dispensar' });
    dismissBtn.addEventListener('click', () => store.dismissActiveAlert());

    const card = el('div', { class: 'ms-ov-card' }, [
      el('div', { class: 'ms-ov-strip' }),
      el('div', { class: 'ms-ov-inner' }, [
        el('div', { class: 'ms-ov-head' }, [
          el('span', { class: 'ms-ov-bellwrap' }, [el('span', { class: 'ms-ov-ring' }), this.ovBell]),
          el('div', { class: 'ms-ov-headtext' }, [this.ovEyebrow, this.ovReason]),
          closeBtn,
        ]),
        el('div', { class: 'ms-ov-snip' }, [
          this.ovAvatar,
          el('div', { class: 'ms-ov-snipbody' }, [el('div', { class: 'ms-ov-sniptop' }, [this.ovWho, this.ovTime]), this.ovText]),
        ]),
        el('div', { class: 'ms-ov-actions' }, [el('div', { class: 'ms-grow' }, [goBtn]), dismissBtn]),
      ]),
    ]);
    this.alertOverlay = el('div', { class: 'ms-ov ms-hidden' }, [card]);
    return this.alertOverlay;
  }

  private updateOverlay(s: AppState) {
    const a = s.alerts.active;
    this.alertOverlay.classList.toggle('ms-hidden', !a);
    if (!a) { this.lastOvKey = ''; return; }
    if (a.key === this.lastOvKey) return;
    this.lastOvKey = a.key;
    const ai = a.mode === 'ai';
    this.ovBell.innerHTML = icons[ai ? 'sparkles' : 'bellRing'];
    this.ovEyebrow.textContent = ai ? 'Detecção por IA' : 'Alerta da reunião';
    this.ovReason.textContent = a.reason;
    this.ovWho.textContent = a.who || '—';
    this.ovTime.textContent = a.t;
    this.ovText.textContent = a.text ? `"${a.text}"` : '';
    this.ovAvatar.replaceChildren(el('span', { text: initials(a.who || '?') }));
    this.ovAvatar.style.background = avatarColor(a.who || '?');
  }


  // ---------- aba Exportar ----------
  private buildExportTab(): HTMLElement {
    this.tgAutoStart = toggleRow({ label: 'Iniciar captura automaticamente', desc: 'Ao entrar na reunião, liga as legendas e começa a capturar.', onChange: (v) => void store.updateSettings({ autoEnableCaptions: v }) });
    this.tgAutoChat = toggleRow({ label: 'Capturar chat de texto', desc: 'Abre o chat do Meet automaticamente quando chega mensagem nova.', onChange: (v) => void store.updateSettings({ autoOpenChat: v }) });
    this.tgHeader = toggleRow({ label: 'Incluir cabeçalho', desc: 'Reunião, link, código, data, horários e participantes.', onChange: (v) => void store.updateSettings({ includeHeaderByDefault: v }).then(() => this.refreshPreview()) });
    this.tgCorrect = toggleRow({ label: 'Corrigir com IA', desc: 'Ajusta pontuação e erros de reconhecimento, sem inventar conteúdo.', onChange: (v) => void store.updateSettings({ enableAiCorrection: v }) });
    this.tgSummary = toggleRow({ label: 'Incluir resumo / ata', desc: 'Adiciona um resumo estruturado ao final do arquivo.', onChange: (v) => void store.updateSettings({ includeSummary: v }) });
    this.tgSeparate = toggleRow({ label: 'Gerar arquivo separado de resumo', desc: 'Baixa a ata como um segundo arquivo .txt.', onChange: (v) => void store.updateSettings({ separateSummaryFile: v }) });
    this.tgJson = toggleRow({ label: 'Dados estruturados (.json)', desc: 'Também baixa um JSON pronto para agentes de IA e automações.', onChange: (v) => void store.updateSettings({ exportJson: v }) });

    // Ollama
    this.ollamaUrlInput = el('input', { class: 'ms-input', type: 'text', placeholder: 'http://localhost:11434', 'aria-label': 'URL do Ollama' }) as HTMLInputElement;
    this.ollamaUrlInput.addEventListener('change', () => {
      const clean = normalizeOllamaUrl(this.ollamaUrlInput.value);
      this.ollamaUrlInput.value = clean;
      void store.updateSettings({ ollamaUrl: clean });
    });
    const testBtn = el('button', { class: 'ms-btn ms-btn-secondary ms-btn-sm', type: 'button', text: 'Testar' });
    testBtn.addEventListener('click', () => this.testOllama());
    this.ollamaStatusEl = el('div', { class: 'ms-status is-idle' });
    this.modelPills = el('div', { class: 'ms-pill-group ms-pill-wrap' });

    // Vocabulário do negócio (termos injetados nos prompts de correção/resumo).
    this.vocabInput = el('input', { class: 'ms-input', type: 'text', placeholder: 'ex.: Acme, Globex, OKRs…', 'aria-label': 'Novo termo' }) as HTMLInputElement;
    const vocabAdd = el('button', { class: 'ms-btn ms-btn-secondary ms-btn-sm', type: 'button' }, [el('span', { class: 'ms-btn-ico', html: icons.plus }), el('span', { text: 'Adicionar' })]);
    const addVocab = () => {
      const terms = this.vocabInput.value.split(',').map((t) => t.trim()).filter(Boolean);
      if (!terms.length) return;
      const merged = [...store.get().settings.vocabulary];
      for (const t of terms) if (!merged.some((x) => x.toLowerCase() === t.toLowerCase())) merged.push(t);
      void store.updateSettings({ vocabulary: merged });
      this.vocabInput.value = '';
      this.vocabInput.focus();
    };
    vocabAdd.addEventListener('click', addVocab);
    this.vocabInput.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); addVocab(); } });
    this.vocabWrap = el('div', { class: 'ms-vocab-chips' });
    this.vocabNote = el('div', { class: 'ms-vocab-note' });
    const vocabSection = el('div', { class: 'ms-section' }, [
      this.sectionLabel('Vocabulário do negócio', icons.tag),
      el('div', { class: 'ms-vocab-desc', html: 'Nomes de empresas, produtos e siglas do seu dia a dia. A IA usa esta lista para corrigir palavras que a transcrição do Google escreveu errado — ex.: <span class="ms-vocab-ex">"acme corp" → "Acme"</span>.' }),
      this.vocabWrap,
      el('div', { class: 'ms-row-gap ms-mt-2' }, [el('div', { class: 'ms-grow' }, [this.vocabInput]), vocabAdd]),
      this.vocabNote,
    ]);

    const ollamaSection = el('div', { class: 'ms-section' }, [
      this.sectionLabel('Integração Ollama', icons.sync),
      el('label', { class: 'ms-label', text: 'URL do servidor' }),
      el('div', { class: 'ms-row-gap' }, [el('div', { class: 'ms-grow' }, [this.ollamaUrlInput]), testBtn]),
      el('div', { class: 'ms-mt-2' }, [this.ollamaStatusEl]),
      el('label', { class: 'ms-label ms-mt-3', text: 'Modelo' }),
      this.modelPills,
      el('div', { class: 'ms-privacy' }, [
        el('span', { class: 'ms-note-ico', html: icons.lock }),
        el('span', { text: 'O conteúdo só é enviado para a URL do Ollama quando a IA estiver ativa. Nada vai para serviços externos.' }),
      ]),
    ]);

    // Preview com sub-abas
    this.preview = el('pre', { class: 'ms-preview ms-scroll' });
    this.previewName = el('div', { class: 'ms-preview-name' });
    const seg = el('div', { class: 'ms-segmented' });
    (['txt', 'ata'] as const).forEach((k) => {
      const b = el('button', { class: 'ms-seg' + (k === 'txt' ? ' is-sel' : ''), type: 'button', text: k === 'txt' ? 'Transcrição' : 'Resumo' }) as HTMLButtonElement;
      b.addEventListener('click', () => { this.previewMode = k; this.previewBtns.forEach((bb, kk) => bb.classList.toggle('is-sel', kk === k)); this.refreshPreview(); });
      this.previewBtns.set(k, b);
      seg.append(b);
    });
    const previewSection = el('div', { class: 'ms-section' }, [
      el('div', { class: 'ms-section-head' }, [this.sectionLabel('Prévia do arquivo', icons.doc), seg]),
      this.preview,
      this.previewName,
    ]);

    // "Seu nome": substitui "Você" na transcrição/exportações/resumos.
    this.selfNameInput = el('input', { class: 'ms-input', type: 'text', placeholder: 'ex.: Diego Araújo', 'aria-label': 'Seu nome' }) as HTMLInputElement;
    this.selfNameInput.addEventListener('change', () => void store.updateSettings({ selfName: this.selfNameInput.value.trim() }));
    const selfNameField = el('div', { class: 'ms-section' }, [
      this.sectionLabel('Seu nome', icons.people),
      this.selfNameInput,
      el('div', { class: 'ms-vocab-desc ms-mt-2', text: 'Aparece no lugar de “Você” na transcrição, nas exportações e nos resumos.' }),
    ]);

    const scroll = el('div', { class: 'ms-tabpanel ms-scroll' }, [
      el('div', { class: 'ms-section' }, [this.sectionLabel('Preferências de captura', icons.clock), this.tgAutoStart.root, this.tgAutoChat.root]),
      selfNameField,
      el('div', { class: 'ms-section' }, [this.sectionLabel('Opções de exportação', icons.settings), this.tgHeader.root, this.tgCorrect.root, this.tgSummary.root, this.tgSeparate.root, this.tgJson.root]),
      vocabSection,
      ollamaSection,
      previewSection,
    ]);
    this.tabPanels.set('export', scroll);
    return scroll;
  }

  private renderVocab(s: AppState) {
    const vocab = s.settings.vocabulary;
    const active = (s.settings.enableAiCorrection || s.settings.includeSummary) && this.ollamaReady(s);
    this.vocabNote.className = 'ms-vocab-note' + (active ? ' is-active' : '');
    this.vocabNote.replaceChildren(
      el('span', { class: 'ms-note-ico', html: active ? icons.checkCircle : icons.info }),
      el('span', {
        text: active
          ? `Será aplicado na correção da transcrição e no resumo (${vocab.length} ${vocab.length === 1 ? 'termo' : 'termos'}).`
          : 'Aplicado automaticamente quando “Corrigir com IA” ou o resumo estiverem ativos.',
      }),
    );
    const sig = vocab.join('');
    if (sig === this.lastVocabSig) return;
    this.lastVocabSig = sig;
    if (!vocab.length) {
      this.vocabWrap.replaceChildren(el('div', { class: 'ms-vocab-empty', text: 'Nenhum termo ainda. Adicione abaixo.' }));
      return;
    }
    this.vocabWrap.replaceChildren(
      ...vocab.map((t) => {
        const chip = el('span', { class: 'ms-vocab-chip' }, [el('span', { text: t })]);
        const x = el('button', { class: 'ms-vocab-x', type: 'button', 'aria-label': `Remover ${t}`, title: 'Remover', html: icons.close });
        x.addEventListener('click', () => void store.updateSettings({ vocabulary: store.get().settings.vocabulary.filter((v) => v !== t) }));
        chip.append(x);
        return chip;
      }),
    );
  }

  // ---------- aba Upload (beta travada) ----------
  private uploadField(label: string, placeholder: string, mono = false): HTMLElement {
    const input = el('input', { class: 'ms-input' + (mono ? ' ms-mono' : ''), type: 'text', placeholder, disabled: true }) as HTMLInputElement;
    return el('label', { class: 'ms-ufield' }, [el('span', { class: 'ms-label', text: label }), input]);
  }

  private buildUploadTab(): HTMLElement {
    const provider = el('div', { class: 'ms-segmented ms-seg-block' }, [
      el('button', { class: 'ms-seg is-sel', type: 'button', text: 'Amazon S3', disabled: true }),
      el('button', { class: 'ms-seg', type: 'button', text: 'MinIO', disabled: true }),
    ]);
    const sendToggle = (label: string, desc: string) => {
      const tg = makeToggle(() => {});
      tg.setDisabled(true);
      return el('div', { class: 'ms-toggle-row is-disabled' }, [
        el('div', { class: 'ms-toggle-labels' }, [el('div', { class: 'ms-toggle-main', text: label }), el('div', { class: 'ms-toggle-help', text: desc })]),
        tg.el,
      ]);
    };
    const sendBtn = el('button', { class: 'ms-btn ms-btn-primary ms-btn-block', type: 'button', text: 'Enviar agora', disabled: true });

    const form = el('div', { class: 'ms-upload-form' }, [
      el('div', { class: 'ms-purpose' }, [
        el('span', { class: 'ms-note-ico', html: icons.database }),
        el('span', { text: 'Envie a transcrição para um bucket S3/MinIO — destino comum para agentes de IA e rotinas automatizadas consumirem as reuniões.' }),
      ]),
      this.sectionLabel('Destino do bucket', icons.database),
      provider,
      this.uploadField('Endpoint', 'http://localhost:9000', true),
      el('div', { class: 'ms-row-gap' }, [this.uploadField('Região', 'us-east-1', true), this.uploadField('Bucket', 'meetsync', true)]),
      this.uploadField('Access Key ID', 'AKIA… / minioadmin', true),
      this.uploadField('Secret Access Key', '••••••••••••', true),
      this.uploadField('Prefixo / pasta (opcional)', 'transcricoes/', true),
      el('div', { class: 'ms-section ms-mt-3b' }, [
        this.sectionLabel('O que enviar', icons.doc),
        sendToggle('Transcrição (.txt)', 'Arquivo de texto com cabeçalho e falas.'),
        sendToggle('Resumo / ata (.txt)', 'Ata gerada pela IA.'),
        sendToggle('Dados estruturados (.json)', 'Payload pronto para agentes de IA e automações.'),
        sendToggle('Enviar automaticamente ao encerrar', 'Sobe os arquivos sozinho quando a reunião termina.'),
      ]),
      el('div', { class: 'ms-mt-3b' }, [sendBtn]),
    ]);

    const scroll = el('div', { class: 'ms-tabpanel ms-scroll' }, [
      el('div', { class: 'ms-locked' }, [
        el('span', { class: 'ms-note-ico', html: icons.lock }),
        el('div', {}, [
          el('div', { class: 'ms-locked-title' }, [el('span', { text: 'Envio para bucket' }), el('span', { class: 'ms-badge', text: 'Beta' })]),
          el('div', { class: 'ms-locked-desc', text: 'O envio para bucket S3/MinIO chega em breve. Os campos abaixo são uma prévia e estão desabilitados.' }),
        ]),
      ]),
      el('div', { class: 'ms-upload-preview' }, [form]),
    ]);
    this.tabPanels.set('upload', scroll);
    return scroll;
  }

  private buildFooter(): HTMLElement {
    this.downloadBtn = el('button', { class: 'ms-btn ms-btn-primary ms-grow', type: 'button', text: 'Baixar transcrição (.txt)' }) as HTMLButtonElement;
    this.downloadBtn.addEventListener('click', () => this.fullDownload());
    this.downloadRawBtn = el('button', { class: 'ms-btn ms-btn-secondary ms-hidden', type: 'button', title: 'Baixar sem IA', text: 'Baixar .txt' }) as HTMLButtonElement;
    this.downloadRawBtn.addEventListener('click', () => this.quickDownload());
    this.footer = el('div', { class: 'ms-footer' }, [el('div', { class: 'ms-btn-row' }, [this.downloadBtn, this.downloadRawBtn])]);
    return this.footer;
  }

  private buildAbout(): HTMLElement {
    const back = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', title: 'Voltar', 'aria-label': 'Voltar', html: icons.chevronLeft });
    const sheet = el('div', { class: 'ms-about ms-hidden' }, [
      el('div', { class: 'ms-about-head' }, [back, el('span', { class: 'ms-about-title', text: 'Sobre' })]),
      el('div', { class: 'ms-about-body ms-scroll' }, [
        el('div', { class: 'ms-about-logo' }, [logoImg(72)]),
        el('span', { class: 'ms-wordmark ms-wordmark-lg' }, [el('span', { class: 'ms-wm-meet', text: 'Meet' }), el('span', { class: 'ms-wm-sync', text: 'Sync' })]),
        el('div', { class: 'ms-about-ver', text: 'Versão MVP 0.1' }),
        el('p', { class: 'ms-about-desc', text: 'Captura e organiza as legendas das suas reuniões do Google Meet e exporta a transcrição em .txt — direto no navegador, com privacidade.' }),
        el('div', { class: 'ms-about-sep' }),
        el('div', { class: 'ms-section-title', text: 'Desenvolvido pela DevSync' }),
        (() => { const a = el('a', { class: 'ms-btn ms-btn-primary ms-btn-block', href: 'https://devsync.com.br', target: '_blank', rel: 'noopener noreferrer', text: 'devsync.com.br' }); return a; })(),
        el('div', { class: 'ms-about-priv', text: 'Os dados da reunião ficam no seu navegador. Nada é enviado para serviços externos sem a sua ação.' }),
      ]),
    ]);
    back.addEventListener('click', () => sheet.classList.add('ms-hidden'));
    return sheet;
  }

  private sectionLabel(text: string, icon: string): HTMLElement {
    return el('div', { class: 'ms-section-label' }, [el('span', { class: 'ms-sl-ico', html: icon }), el('span', { text })]);
  }

  // ================= Histórico de reuniões (sheet) =================
  private buildHistorySheet(): HTMLElement {
    // --- lista ---
    const back = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', type: 'button', title: 'Voltar', 'aria-label': 'Voltar', html: icons.chevronLeft });
    back.addEventListener('click', () => this.closeHistory());
    this.histCount = el('span', { class: 'ms-hist-count' });
    this.histSearch = el('input', { class: 'ms-input', type: 'text', placeholder: 'Buscar por título ou participante', 'aria-label': 'Buscar' }) as HTMLInputElement;
    this.histSearch.addEventListener('input', () => { this.histQuery = this.histSearch.value; this.renderHistoryList(); });
    this.histList = el('div', { class: 'ms-hist-list' });
    this.histListView = el('div', { class: 'ms-hist-view' }, [
      el('div', { class: 'ms-hist-head' }, [back, el('span', { class: 'ms-hist-title', text: 'Histórico de reuniões' }), this.histCount]),
      el('div', { class: 'ms-hist-search' }, [this.histSearch]),
      el('div', { class: 'ms-hist-scroll ms-scroll' }, [
        this.histList,
        el('div', { class: 'ms-hist-privacy' }, [
          el('span', { class: 'ms-note-ico', html: icons.lock }),
          el('span', { text: 'O histórico fica salvo apenas neste navegador. Exporte para guardar fora do dispositivo.' }),
        ]),
      ]),
    ]);

    // --- detalhe (preenchido ao abrir) ---
    this.histDetailView = el('div', { class: 'ms-hist-view ms-hidden' });

    return el('div', { class: 'ms-hist ms-hidden' }, [this.histListView, this.histDetailView]);
  }

  private openHistory() {
    this.histDetailView.classList.add('ms-hidden');
    this.histListView.classList.remove('ms-hidden');
    this.historySheet.classList.remove('ms-hidden');
    void this.refreshHistory();
  }

  private closeHistory() {
    this.historySheet.classList.add('ms-hidden');
    const s = store.get();
    // Se foi aberto fora de reunião (modo revisão), esconde o painel ao fechar.
    if (s.ui.review && !s.inMeeting && !s.ended) store.patchUi({ historyOpen: false, review: false, expanded: false });
    else store.patchUi({ historyOpen: false });
  }

  private async refreshHistory() {
    this.histMetas = await loadHistory();
    this.renderHistoryList();
  }

  private renderHistoryList() {
    const q = this.histQuery.trim().toLowerCase();
    const list = this.histMetas.filter(
      (m) => !q || m.title.toLowerCase().includes(q) || m.participants.some((p) => p.toLowerCase().includes(q)),
    );
    const n = this.histMetas.length;
    this.histCount.replaceChildren(
      el('span', { class: 'ms-hist-count-ico', html: icons.history }),
      el('span', { text: `${n} ${n === 1 ? 'reunião' : 'reuniões'}` }),
    );
    if (!list.length) {
      this.histList.replaceChildren(
        el('div', { class: 'ms-hist-empty' }, [
          el('span', { class: 'ms-hist-empty-ico', html: icons.history }),
          el('span', { text: this.histMetas.length ? 'Nenhuma reunião encontrada.' : 'Nenhuma reunião no histórico ainda.' }),
        ]),
      );
      return;
    }
    this.histList.replaceChildren(...list.map((m) => this.historyCard(m)));
  }

  private historyCard(m: HistoryMeta): HTMLElement {
    const when = m.startISO ?? m.savedAt;
    const d = new Date(when);
    const dateTile = el('div', { class: 'ms-hist-tile' }, [
      el('span', { class: 'ms-hist-tile-day', text: isNaN(d.getTime()) ? '–' : String(d.getDate()) }),
      el('span', { class: 'ms-hist-tile-mon', text: isNaN(d.getTime()) ? '' : MONTHS_ABBR[d.getMonth()]! }),
    ]);

    const titleRow = el('div', { class: 'ms-hist-c-titlerow' }, [
      ...(m.starred ? [el('span', { class: 'ms-hist-star', html: icons.starFill })] : []),
      el('span', { class: 'ms-hist-c-title', text: m.title }),
    ]);
    const timeText = m.startISO
      ? `${formatTime(m.startISO)}${m.endISO ? '–' + formatTime(m.endISO) : ''} · ${fmtDuration(m.durationMin)}`
      : fmtDuration(m.durationMin);
    const timeRow = el('div', { class: 'ms-hist-c-meta' }, [
      el('span', { class: 'ms-hist-mi-ico', html: icons.clock }),
      el('span', { text: timeText }),
    ]);
    const top = el('div', { class: 'ms-hist-c-top' }, [
      dateTile,
      el('div', { class: 'ms-hist-c-left' }, [titleRow, timeRow]),
      avatarStack(m.participants, 4),
    ]);

    const children: Node[] = [top];
    if (m.preview) {
      children.push(
        el('div', { class: 'ms-hist-c-preview' }, [
          el('span', { class: 'ms-hist-c-pwho', text: `${m.preview.who.split(' ')[0]}:` }),
          el('span', { text: ` ${m.preview.text}` }),
        ]),
      );
    }
    children.push(
      el('div', { class: 'ms-hist-c-chips' }, [
        metaChip(icons.chatBubble, `${m.lines} ${m.lines === 1 ? 'linha' : 'linhas'}`),
        m.hasSummary ? metaChip(icons.doc, 'Com ata', true) : metaChip(icons.doc, 'Sem ata'),
        el('span', { class: 'ms-hist-c-spacer' }),
        metaChip(icons.cloudUp, 'Local'),
      ]),
    );

    const card = el('button', { class: 'ms-hist-card', type: 'button' }, children);
    card.addEventListener('click', () => void this.openDetail(m));
    return card;
  }

  private async openDetail(m: HistoryMeta) {
    const saved = await loadMeeting(m.id);
    if (!saved) { void this.refreshHistory(); return; }
    const session = saved.session;
    const summaryText = saved.summaryText;

    const back = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', type: 'button', title: 'Voltar', 'aria-label': 'Voltar', html: icons.chevronLeft });
    back.addEventListener('click', () => { this.renderHistoryList(); this.histDetailView.classList.add('ms-hidden'); this.histListView.classList.remove('ms-hidden'); });

    const star = el('button', { class: 'ms-icon-btn ms-icon-btn-sm ms-hist-d-star' + (m.starred ? ' is-on' : ''), type: 'button', title: 'Favoritar', 'aria-label': 'Favoritar', html: m.starred ? icons.starFill : icons.star });
    star.addEventListener('click', () => void (async () => {
      m.starred = !m.starred;
      star.innerHTML = m.starred ? icons.starFill : icons.star;
      star.classList.toggle('is-on', m.starred);
      await setMeetingStarred(m.id, m.starred);
      this.histMetas = await loadHistory();
    })());

    const head = el('div', { class: 'ms-hist-head' }, [
      back,
      el('div', { class: 'ms-hist-d-titlewrap' }, [
        el('div', { class: 'ms-hist-title', text: m.title }),
        el('div', { class: 'ms-hist-d-sub', text: `${fmtFullDate(m.startISO ?? m.savedAt)} · ${m.startISO ? formatTime(m.startISO) : ''}${m.endISO ? '–' + formatTime(m.endISO) : ''}` }),
      ]),
      star,
    ]);

    // métricas
    const strip = el('div', { class: 'ms-hist-d-strip' }, [
      el('div', { class: 'ms-hist-d-stat' }, [el('div', { class: 'ms-hist-d-statk', text: 'Duração' }), el('div', { class: 'ms-hist-d-statv', text: fmtDuration(m.durationMin) })]),
      el('div', { class: 'ms-hist-d-stat' }, [el('div', { class: 'ms-hist-d-statk', text: 'Linhas / chat' }), el('div', { class: 'ms-hist-d-statv' }, [el('span', { text: String(m.lines) }), el('span', { class: 'ms-hist-d-statsub', text: ` · ${m.chats} chat` })])]),
    ]);

    // participantes
    const people = el('div', { class: 'ms-hist-d-people' }, [avatarStack(m.participants, 6), el('span', { class: 'ms-hist-d-pcount', text: `${m.participants.length} pessoas` })]);

    // segmented + preview
    const previewBox = el('div', { class: 'ms-hist-d-preview' });
    let view: 'transcript' | 'summary' = 'transcript';
    const segBtns = new Map<'transcript' | 'summary', HTMLButtonElement>();
    const renderPreview = () => {
      for (const [k, b] of segBtns) b.classList.toggle('is-sel', k === view);
      if (view === 'transcript') {
        const ordered = [...session.transcript].sort((a, b) => (a.capturedAt < b.capturedAt ? -1 : a.capturedAt > b.capturedAt ? 1 : 0));
        const shown = ordered.slice(0, 14);
        previewBox.replaceChildren(
          ...shown.map((e, i) =>
            el('div', { class: 'ms-hist-pv-row' + (i > 0 ? ' has-sep' : '') }, [
              el('div', { class: 'ms-hist-pv-who', text: e.participantName }),
              el('div', { class: 'ms-hist-pv-text', text: e.text }),
            ]),
          ),
          el('div', { class: 'ms-hist-pv-foot', text: `Prévia · ${m.lines} linhas no total` }),
        );
      } else {
        previewBox.replaceChildren(el('div', { class: 'ms-hist-pv-summary', text: summaryText ?? 'Esta reunião não tem ata gerada.' }));
      }
    };
    const seg = el('div', { class: 'ms-hist-d-seg' });
    ([['transcript', 'Transcrição'], ['summary', 'Resumo']] as const).forEach(([k, label]) => {
      const dis = k === 'summary' && !summaryText;
      const b = el('button', { class: 'ms-hist-seg-btn', type: 'button', text: label }) as HTMLButtonElement;
      if (dis) b.classList.add('is-disabled');
      else b.addEventListener('click', () => { view = k; renderPreview(); });
      segBtns.set(k, b);
      seg.append(b);
    });

    // ações
    const dlTxt = this.histAction(icons.download, 'Baixar transcrição (.txt)', 'Arquivo de texto com cabeçalho e falas', false, () =>
      downloadText(buildFilename(session), buildTxt(session, { includeHeader: true })),
    );
    const dlAta = this.histAction(icons.doc, 'Baixar resumo / ata', summaryText ? 'Ata estruturada desta reunião' : 'Esta reunião não tem ata gerada', !summaryText, () => {
      if (summaryText) downloadText(buildFilename(session, '_resumo'), buildSummaryTxt(session, summaryText));
    });
    const del = this.histAction(icons.trash, 'Excluir do histórico', 'Apaga a transcrição deste dispositivo', false, () => void (async () => {
      await deleteMeeting(m.id);
      this.histDetailView.classList.add('ms-hidden');
      this.histListView.classList.remove('ms-hidden');
      void this.refreshHistory();
    })(), true);

    const scroll = el('div', { class: 'ms-hist-scroll ms-scroll' }, [
      strip,
      this.sectionLabel('Participantes', icons.people),
      people,
      seg,
      previewBox,
      this.sectionLabel('Ações', icons.download),
      el('div', { class: 'ms-hist-actions' }, [dlTxt, dlAta, del]),
    ]);

    renderPreview();
    this.histDetailView.replaceChildren(head, scroll);
    this.histListView.classList.add('ms-hidden');
    this.histDetailView.classList.remove('ms-hidden');
  }

  private histAction(icon: string, label: string, sub: string, disabled: boolean, onClick: () => void, danger = false): HTMLElement {
    const row = el('button', { class: 'ms-hist-action' + (danger ? ' is-danger' : '') + (disabled ? ' is-disabled' : ''), type: 'button' }, [
      el('span', { class: 'ms-hist-action-ico', html: icon }),
      el('div', { class: 'ms-hist-action-body' }, [el('div', { class: 'ms-hist-action-label', text: label }), el('div', { class: 'ms-hist-action-sub', text: sub })]),
      ...(danger ? [] : [el('span', { class: 'ms-hist-action-chev', html: icons.chevronRight })]),
    ]);
    if (!disabled) row.addEventListener('click', onClick);
    return row;
  }


  // ================= Atualização reativa =================
  private update(s: AppState) {
    const visible = s.inMeeting || s.ended || !!s.ui.review; // pós-reunião / revisão de histórico
    this.compact.classList.toggle('ms-hidden', s.ui.expanded || !visible);
    this.panel.classList.toggle('ms-hidden', !s.ui.expanded || !visible);

    // Sheet de histórico (abre por mensagem do popup ou pelo botão do header).
    if (!!s.ui.historyOpen !== this.lastHistoryOpen) {
      this.lastHistoryOpen = !!s.ui.historyOpen;
      if (s.ui.historyOpen) this.openHistory();
      else this.historySheet.classList.add('ms-hidden');
    }

    this.ccBtn.classList.toggle('is-active', s.captionsOn);
    this.captionsToggle.setOn(s.captionsOn);
    this.captionsToggle.setDisabled(s.ended);

    // Indicador compacto + status strip (REC/clay) — só atualiza quando o estado muda.
    if (this.lastDotKind !== s.captureStatus) {
      this.lastDotKind = s.captureStatus;
      const map: Record<string, { dot: string; label: string; lcls: string }> = {
        capturing: { dot: 'is-rec', label: 'Captura ativa', lcls: 'is-rec' },
        processing: { dot: 'is-processing', label: 'Processando', lcls: '' },
        error: { dot: 'is-error', label: 'Erro IA', lcls: 'is-error' },
      };
      const m = map[s.captureStatus] ?? { dot: 'is-paused', label: 'Pausado', lcls: 'is-paused' };
      this.compactDot.className = `ms-dot ${m.dot}`;
      this.compactDotLabel.textContent = m.label;
      this.compactDotLabel.className = m.lcls;
    }
    if (s.ended) statusInto(this.stripStatus, 'idle', 'Reunião encerrada — revise e baixe abaixo');
    else if (s.captureStatus === 'capturing') statusInto(this.stripStatus, 'rec', 'Captura ativa');
    else if (s.captureStatus === 'processing') statusInto(this.stripStatus, 'busy', 'Processando…');
    else if (s.captureStatus === 'error') statusInto(this.stripStatus, 'error', 'Erro ao processar IA');
    else statusInto(this.stripStatus, 'paused', 'Captura pausada');

    // Tabs
    for (const [id, btn] of this.tabBtns) btn.classList.toggle('is-active', s.ui.activeTab === id);
    for (const [id, p] of this.tabPanels) p.classList.toggle('ms-hidden', s.ui.activeTab !== id);
    this.footer.classList.toggle('ms-hidden', s.ui.activeTab === 'upload');

    const ready = this.ollamaReady(s);

    // Resumo
    this.rtToggle.setOn(s.settings.realtimeSummary);
    this.rtToggle.setDisabled(!ready);
    this.renderIntervalPills(s);
    this.renderRtStatus();
    this.renderSummaryContent(s);

    // Export toggles
    this.tgAutoStart.setOn(s.settings.autoEnableCaptions);
    this.tgAutoChat.setOn(s.settings.autoOpenChat);
    this.tgHeader.setOn(s.settings.includeHeaderByDefault);
    this.tgCorrect.setOn(s.settings.enableAiCorrection); this.tgCorrect.setDisabled(!ready); this.tgCorrect.setNote(ready ? null : 'Requer Ollama configurado e modelo selecionado.');
    this.tgSummary.setOn(s.settings.includeSummary); this.tgSummary.setDisabled(!ready); this.tgSummary.setNote(ready ? null : 'Requer Ollama configurado e modelo selecionado.');
    this.tgSeparate.setOn(s.settings.separateSummaryFile); this.tgSeparate.setDisabled(!ready || !s.settings.includeSummary); this.tgSeparate.setNote(!ready ? 'Requer Ollama configurado.' : (!s.settings.includeSummary ? 'Ative “Incluir resumo / ata” primeiro.' : null));
    this.tgJson.setOn(s.settings.exportJson);
    if (document.activeElement !== this.selfNameInput && this.selfNameInput.value !== s.settings.selfName) this.selfNameInput.value = s.settings.selfName;
    this.renderVocab(s);

    // Alertas de menção — barra de arme, som, regras, recentes
    const armed = s.settings.alertsArmed;
    this.tgArmed.setOn(armed);
    this.armCard.classList.toggle('is-armed', armed);
    this.armIcon.innerHTML = icons.ear;
    this.armSub.textContent = armed ? 'Ouvindo · você será avisado mesmo distraído' : 'Pausado · nenhum alerta será disparado';
    this.tgSound.setOn(s.settings.alertSound);
    this.tgSound.setDisabled(!armed);
    this.soundRow.classList.toggle('is-disabled', !armed);
    this.renderWatches(s);
    this.renderRecent(s);

    // Banner + sininho da barra compacta
    this.updateOverlay(s);
    this.bellIcon.innerHTML = icons.ear;
    this.bellBtn.classList.toggle('is-armed', armed);
    this.bellBtn.classList.toggle('has-alert', s.alerts.unread > 0);
    this.bellBadge.classList.toggle('ms-hidden', s.alerts.unread === 0);
    this.bellBadge.textContent = s.alerts.unread > 9 ? '9+' : String(s.alerts.unread);
    if (this.alertsTabBadge) {
      this.alertsTabBadge.classList.toggle('ms-hidden', s.alerts.unread === 0);
      this.alertsTabBadge.textContent = s.alerts.unread > 9 ? '9+' : String(s.alerts.unread);
    }
    // Ao visualizar a aba Alertas, zera o não-lido (defere para evitar reentrância no emit).
    if (s.ui.expanded && s.ui.activeTab === 'alerts' && s.alerts.unread > 0) {
      queueMicrotask(() => store.clearAlertUnread());
    }

    // Ollama
    if (document.activeElement !== this.ollamaUrlInput && this.ollamaUrlInput.value !== s.settings.ollamaUrl) this.ollamaUrlInput.value = s.settings.ollamaUrl;
    this.renderOllamaStatus(s);
    this.renderModelPills(s);

    this.renderChat(s);
    this.refreshPreview();
    this.renderFooter(s);
    this.syncRealtimeTimer(s);
  }

  private renderFooter(s: AppState) {
    const aiActive = this.ollamaReady(s) && (s.settings.enableAiCorrection || s.settings.includeSummary);
    this.downloadBtn.textContent = this.busy ? 'Processando com Ollama…' : (aiActive ? 'Baixar .txt com IA' : 'Baixar transcrição (.txt)');
    this.downloadBtn.disabled = this.busy;
    this.downloadRawBtn.classList.toggle('ms-hidden', !aiActive || this.busy);
  }

  // ---------- Resumo: status + conteúdo ----------
  private rtKey = '';
  private rtTextEl: HTMLElement | null = null;
  private rtModelEl: HTMLElement | null = null;
  private renderRtStatus() {
    const s = store.get();
    const active = s.settings.realtimeSummary && this.ollamaReady(s) && s.inMeeting;

    // Decide ícone (spinner|dot|none), classe e texto.
    let icon: 'spinner' | 'dot' | 'none';
    let cls: string;
    let text = '';
    if (s.ui.summarizing) {
      icon = 'spinner'; cls = 'ms-sum-status is-generating'; text = 'Gerando resumo · aguardando o Ollama…';
    } else if (!active) {
      icon = 'none'; cls = 'ms-sum-status ms-hidden';
    } else {
      const n = s.session.transcript.length;
      const pending = this.transcriptSig(s) !== this.lastRtSig;
      const secs = Math.max(0, Math.ceil((this.nextRtAt - Date.now()) / 1000));
      const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      if (n === 0) text = 'Aguardando as primeiras falas…';
      else if (secs > 0) text = `Ao vivo · próxima em ${mmss}${pending ? ' · novas falas' : ''}`;
      else text = 'Atualizando…';
      icon = 'dot'; cls = 'ms-sum-status is-listening';
    }

    // Só recria os filhos quando o TIPO de ícone muda (evita reiniciar a animação a cada update/stream).
    if (this.rtKey !== icon) {
      this.rtKey = icon;
      if (icon === 'none') {
        this.summaryStatus.replaceChildren();
        this.rtTextEl = null;
        this.rtModelEl = null;
      } else {
        const ic = icon === 'spinner' ? el('span', { class: 'ms-spinner' }) : el('span', { class: 'ms-status-dot ms-pulse-blue' });
        this.rtTextEl = el('span', { text });
        this.rtModelEl = el('span', { class: 'ms-sum-model' });
        this.summaryStatus.replaceChildren(ic, this.rtTextEl, this.rtModelEl);
      }
    } else if (this.rtTextEl && this.rtTextEl.textContent !== text) {
      this.rtTextEl.textContent = text;
    }
    if (this.rtModelEl) {
      const model = s.settings.ollamaModel ?? '';
      if (this.rtModelEl.textContent !== model) this.rtModelEl.textContent = model;
    }
    if (this.summaryStatus.className !== cls) this.summaryStatus.className = cls;
  }

  private renderSummaryContent(s: AppState) {
    if (s.ui.summaryText) {
      const tag = s.ui.summarizing ? `${s.ui.summaryText} stream` : s.ui.summaryText;
      if (tag !== this.renderedSummary) {
        this.renderedSummary = tag;
        renderMarkdownInto(this.summaryContent, s.ui.summaryText, s.ui.summarizing);
      }
      return;
    }
    if (s.ui.summarizing) {
      if (this.renderedSummary !== '__skel__') { this.renderedSummary = '__skel__'; this.renderSkeleton(); }
      return;
    }
    let msg: string;
    if (!this.ollamaReady(s)) msg = 'Configure um servidor Ollama na aba Exportar e escolha um modelo para gerar a ata.';
    else if (!s.settings.realtimeSummary) msg = 'Ative “Resumo em tempo real” acima, ou gere a ata ao baixar.';
    else if (s.session.transcript.length === 0) msg = 'Resumo em tempo real ativo ✓ Aguardando as primeiras falas…';
    else msg = 'Resumo em tempo real ativo ✓ A ata será gerada em instantes.';
    const ph = `__ph__${msg}`;
    if (this.renderedSummary !== ph) { this.renderedSummary = ph; this.summaryContent.replaceChildren(el('div', { class: 'ms-sum-p', text: msg })); }
  }

  private renderSkeleton() {
    const widths = ['45%', '92%', '80%', '60%', '88%', '70%'];
    this.summaryContent.replaceChildren(...widths.map((w) => { const l = el('div', { class: 'ms-skel-line ms-shimmer' }); l.style.width = w; return l; }));
  }

  // ---------- Ollama UI ----------
  private renderOllamaStatus(s: AppState) {
    if (s.ollama.testing) statusInto(this.ollamaStatusEl, 'busy', 'Conectando ao servidor…');
    else if (s.ollama.lastError) statusInto(this.ollamaStatusEl, 'error', `Erro: ${s.ollama.lastError}`);
    else if (s.ollama.reachable && s.ollama.models.length) statusInto(this.ollamaStatusEl, 'active', `Conectado — ${s.ollama.models.length} modelos`);
    else statusInto(this.ollamaStatusEl, 'idle', 'Não conectado');
  }

  private renderModelPills(s: AppState) {
    const models = s.ollama.models;
    const sig = models.join(',') + '|' + (s.settings.ollamaModel ?? '');
    if (this.modelPills.dataset.sig === sig) return;
    this.modelPills.dataset.sig = sig;
    if (!models.length) {
      this.modelPills.replaceChildren(el('span', { class: 'ms-muted-sm', text: 'Teste a conexão para listar os modelos.' }));
      return;
    }
    this.modelPills.replaceChildren(
      ...models.map((m) => {
        const sel = s.settings.ollamaModel === m;
        const b = el('button', { class: 'ms-pill ms-pill-mono' + (sel ? ' is-sel' : ''), type: 'button', text: m }) as HTMLButtonElement;
        b.addEventListener('click', () => void store.updateSettings({ ollamaModel: m }));
        return b;
      }),
    );
  }

  // ---------- Chat ----------
  private renderChat(s: AppState) {
    const entries = s.session.transcript;
    if (entries.length === 0) {
      if (!this.chatList.querySelector('.ms-chat-empty')) {
        this.chatNodes.clear();
        this.chatList.replaceChildren(el('div', { class: 'ms-chat-empty', text: 'Nenhuma fala capturada ainda. Ative as legendas do Meet para começar.' }));
      }
      this.renderTail(s);
      return;
    }
    const empty = this.chatList.querySelector('.ms-chat-empty');
    if (empty) empty.remove();

    for (const e of entries) {
      const existing = this.chatNodes.get(e.id);
      if (existing) {
        if (existing.text.textContent !== e.text) linkify(existing.text, e.text);
        existing.time.textContent = formatTime(e.capturedAt);
      } else {
        const isChat = e.source === 'google-meet-chat';
        let avatar: HTMLElement;
        if (e.participantAvatarUrl) {
          avatar = el('img', { class: 'ms-avatar', src: e.participantAvatarUrl, alt: e.participantName }) as HTMLElement;
        } else {
          avatar = el('div', { class: 'ms-avatar', text: initials(e.participantName) });
          avatar.style.background = avatarColor(e.participantName);
          avatar.style.color = '#fff';
        }
        const name = el('span', { class: 'ms-msg-name', text: e.participantName });
        const time = el('span', { class: 'ms-msg-time', text: formatTime(e.capturedAt) });
        const head = el('div', { class: 'ms-msg-head' }, [name]);
        if (isChat) head.append(el('span', { class: 'ms-msg-tag' }, [el('span', { class: 'ms-tag-ico', html: icons.chatBubble }), el('span', { text: 'chat' })]));
        head.append(time);
        const text = el('div', { class: 'ms-msg-text' + (isChat ? ' is-chat' : '') });
        linkify(text, e.text);
        const row = el('div', { class: 'ms-msg' }, [avatar, el('div', { class: 'ms-msg-body' }, [head, text])]);
        this.chatList.append(row);
        this.chatNodes.set(e.id, { row, text, time });
      }
    }

    // Ordena cronologicamente por capturedAt. As mensagens de chat só são capturadas quando o
    // painel de chat abre (tarde), mas carregam o horário real (antigo) — sem isto entrariam fora
    // de ordem no fim da lista e o começo da reunião "sumiria". Reconcilia o DOM in-place.
    const ordered = entries
      .map((e, i) => ({ e, i }))
      .sort((a, b) => (a.e.capturedAt < b.e.capturedAt ? -1 : a.e.capturedAt > b.e.capturedAt ? 1 : a.i - b.i));
    ordered.forEach(({ e }, idx) => {
      const node = this.chatNodes.get(e.id)?.row;
      if (!node) return;
      const current = this.chatList.children[idx];
      if (current !== node) this.chatList.insertBefore(node, current ?? null);
    });

    this.renderTail(s);
    if (this.autoScroll) this.transcriptScroll.scrollTop = this.transcriptScroll.scrollHeight;
  }

  private renderTail(s: AppState) {
    if (s.ended) statusInto(this.tailStatus, 'idle', 'Reunião encerrada — esta transcrição fica aqui até você sair da aba.');
    else if (s.captureStatus === 'capturing') statusInto(this.tailStatus, 'rec', 'Capturando legendas em tempo real…');
    else statusInto(this.tailStatus, 'paused', 'Captura pausada — ligue as legendas para continuar');
  }

  private refreshPreview() {
    const s = store.get();
    let txt: string;
    if (this.previewMode === 'ata') {
      txt = s.ui.summaryText ? buildSummaryTxt(s.session, s.ui.summaryText) : 'Gere o resumo/ata (aba Resumo ou no download) para ver a prévia aqui.';
    } else {
      txt = buildTxt(s.session, { includeHeader: s.settings.includeHeaderByDefault });
    }
    this.preview.textContent = txt.slice(0, 1400) + (txt.length > 1400 ? '\n…' : '');
    this.previewName.textContent = buildFilename(s.session);
  }

  // ================= Ações =================
  private quickDownload() {
    const s = store.get();
    if (!s.session.captureEndedAt) store.setCaptureEndedAt(new Date().toISOString());
    const content = buildTxt(store.get().session, { includeHeader: s.settings.includeHeaderByDefault });
    downloadText(buildFilename(store.get().session), content);
  }

  private async testOllama() {
    const url = normalizeOllamaUrl(this.ollamaUrlInput.value || store.get().settings.ollamaUrl);
    this.ollamaUrlInput.value = url;
    await store.updateSettings({ ollamaUrl: url });
    store.patchOllama({ testing: true, lastError: undefined });
    try {
      const models = await ollama.listModels(url);
      store.patchOllama({ testing: false, reachable: true, models });
      if (!store.get().settings.ollamaModel && models.length > 0) await store.updateSettings({ ollamaModel: models[0] });
    } catch (err) {
      store.patchOllama({ testing: false, reachable: false, models: [], lastError: err instanceof Error ? err.message : String(err) });
    }
  }

  private async fullDownload() {
    const s = store.get();
    store.setCaptureEndedAt(new Date().toISOString());
    const session = store.get().session;
    const settings = s.settings;
    const ready = this.ollamaReady(s);

    this.busy = true; this.renderFooter(store.get());
    window.addEventListener('beforeunload', this.unloadGuard);
    try {
      let corrected = false;
      let correctedText = '';
      let summaryText: string | undefined;

      if ((settings.enableAiCorrection || settings.includeSummary) && ready) store.setCaptureStatus('processing');

      if (settings.enableAiCorrection && ready) {
        try { correctedText = await correctTranscript(session, settings.ollamaUrl, settings.ollamaModel!, settings.vocabulary); corrected = true; }
        catch (err) { store.setCaptureStatus('error'); store.patchOllama({ lastError: `Correção falhou: ${err instanceof Error ? err.message : String(err)}` }); }
      }
      if (settings.includeSummary && ready) {
        try { summaryText = await summarizeMeeting(session, settings.ollamaUrl, settings.ollamaModel!, settings.vocabulary); store.patchUi({ summaryText }); }
        catch (err) { store.setCaptureStatus('error'); store.patchOllama({ lastError: `Resumo falhou: ${err instanceof Error ? err.message : String(err)}` }); }
      }

      const includeSummaryInline = !!summaryText && !settings.separateSummaryFile;
      const mainContent = corrected
        ? (settings.includeHeaderByDefault ? buildHeader(session) : '') + correctedText + (includeSummaryInline ? `\n\n${summaryText}` : '')
        : buildTxt(session, { includeHeader: settings.includeHeaderByDefault, summaryText: includeSummaryInline ? summaryText : undefined });

      // Espaça os downloads — o Chrome descarta downloads automáticos disparados juntos.
      const gap = () => new Promise<void>((r) => setTimeout(r, 500));
      downloadText(buildFilename(session), mainContent);
      if (summaryText && settings.separateSummaryFile) { await gap(); downloadText(buildFilename(session, '_resumo'), buildSummaryTxt(session, summaryText)); }
      if (settings.exportJson) { await gap(); downloadText(buildFilename(session, '', 'json'), buildMeetingJson(session, summaryText)); }

      if (store.get().captureStatus === 'processing') store.setCaptureStatus(store.get().captionsOn ? 'capturing' : 'waiting');
    } finally {
      this.busy = false; this.renderFooter(store.get());
      window.removeEventListener('beforeunload', this.unloadGuard);
    }
  }

  // ================= Realtime scheduler =================
  private syncRealtimeTimer(s: AppState) {
    const shouldRun = s.settings.realtimeSummary && this.ollamaReady(s) && s.inMeeting;
    const intervalMs = Math.min(60, Math.max(1, s.settings.summaryIntervalMin || 2)) * 60000;
    if (shouldRun) {
      if (this.rtTimer === null || this.rtTimerIntervalMs !== intervalMs) {
        if (this.rtTimer !== null) clearInterval(this.rtTimer);
        this.rtTimerIntervalMs = intervalMs;
        this.nextRtAt = Date.now() + intervalMs;
        this.rtTimer = window.setInterval(() => this.rtTick(), intervalMs);
        this.rtTick();
      }
    } else if (this.rtTimer !== null) {
      clearInterval(this.rtTimer);
      this.rtTimer = null;
    }
  }

  private transcriptSig(s: AppState): string {
    let chars = 0;
    for (const e of s.session.transcript) chars += e.text.length;
    return `${s.session.transcript.length}:${chars}`;
  }

  private rtTick() {
    this.nextRtAt = Date.now() + this.rtTimerIntervalMs;
    const s = store.get();
    if (!s.settings.realtimeSummary || !this.ollamaReady(s) || !s.inMeeting) return;
    if (s.ui.summarizing) return;
    if (this.transcriptSig(s) === this.lastRtSig) return;
    void this.generateRealtimeSummary();
  }

  private rtUiTick() {
    const s = store.get();
    const active = s.settings.realtimeSummary && this.ollamaReady(s) && s.inMeeting;
    if (active && !s.ui.summarizing && !s.ui.summaryText && s.session.transcript.length > 0) void this.generateRealtimeSummary();
    if (active) this.renderRtStatus();
  }

  private async generateRealtimeSummary() {
    const s = store.get();
    this.lastRtSig = this.transcriptSig(s);
    store.patchUi({ summarizing: true });
    try {
      const text = await summarizeMeetingStream(s.session, s.settings.ollamaUrl, s.settings.ollamaModel!, (acc) => store.patchUi({ summaryText: acc }), s.settings.vocabulary);
      store.patchUi({ summaryText: text, summarizing: false });
    } catch {
      store.patchUi({ summarizing: false });
    }
  }

  private ollamaReady(s: AppState): boolean {
    return s.ollama.reachable && s.ollama.models.length > 0 && !!s.settings.ollamaModel;
  }

  // ================= Drag =================
  private async loadOffset() {
    try {
      const res = await chrome.storage.local.get('meetsync:offset');
      const o = res['meetsync:offset'] as { x: number; y: number } | undefined;
      if (o) { this.dragOffset = o; this.applyOffset(); }
    } catch { /* ignore */ }
  }

  private applyOffset() {
    const t = `translate(${this.dragOffset.x}px, ${this.dragOffset.y}px)`;
    if (this.compact) this.compact.style.transform = t;
    if (this.panel) this.panel.style.transform = t;
  }

  private enableDrag(handle: HTMLElement | null) {
    if (!handle) return;
    handle.style.cursor = 'grab';
    handle.addEventListener('pointerdown', (ev: PointerEvent) => {
      const target = ev.target as HTMLElement;
      if (target.closest('button, input, select, a, [role="switch"]')) return;
      ev.preventDefault();
      const startX = ev.clientX, startY = ev.clientY;
      const base = { ...this.dragOffset };
      handle.style.cursor = 'grabbing';
      const onMove = (e: PointerEvent) => {
        const lim = window.innerHeight * 0.45;
        this.dragOffset = {
          x: Math.min(24, Math.max(-(window.innerWidth - 120), base.x + (e.clientX - startX))),
          y: Math.min(lim, Math.max(-lim, base.y + (e.clientY - startY))),
        };
        this.applyOffset();
      };
      const onUp = () => {
        handle.style.cursor = 'grab';
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        try { void chrome.storage.local.set({ 'meetsync:offset': this.dragOffset }); } catch { /* ignore */ }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }
}
