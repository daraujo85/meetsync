// UI do MeetSync: barra compacta (§10.1) + painel expandido (§10.2). Vanilla TS, dentro do
// Shadow DOM. Assina o `store` e atualiza o DOM. Estrutura segue o mockup (HANDOFF §3):
// header · status strip · tabs (Transcrição/Resumo/Exportar/Upload) · conteúdo · footer.

import { el } from './dom';
import { icons } from './icons';
import { logoImg } from './logo';
import { store, cryptoRandomId, type AppState } from '@/services/store';
import type { AlertDetection, AlertMode, MeetingSession } from '@/types';
import {
  loadHistory,
  loadMeeting,
  deleteMeeting,
  setMeetingStarred,
  renameMeeting,
  updateMeetingSummary,
  buildMeetingBackup,
  importMeetingBackup,
  type HistoryMeta,
} from '@/services/storage-service';
import {
  buildTxt,
  buildSummaryTxt,
  buildFilename,
  buildHeader,
  buildMeetingJson,
  summarySectionBlock,
  downloadText,
  formatTime,
  isGenericTitle,
  isGenericTitleText,
} from '@/services/export-txt';
import { correctTranscript, summarizeMeeting, summarizeMeetingStream, askMeetingStream, suggestMeetingTitle, looksLikeBadAiTitle, type ChatTurn } from '@/services/summary-service';
import { ollama, normalizeOllamaUrl } from '@/services/ollama-client';
import { initials } from '@/content/participant-resolver';
import { t, bcp47, getLocale, seedWatchText, LOCALES, type Locale } from '@/i18n';

export type PanelController = {
  /** Liga/desliga as legendas do Meet (botão CC). */
  toggleCaptions: () => void;
  /** Dispara um alerta de teste a partir de uma regra ("Simular detecção"). */
  simulateAlert: (detection: AlertDetection) => void;
};

type TabId = 'transcript' | 'summary' | 'alerts' | 'export' | 'upload';
const TABS: Array<{ id: TabId; beta?: boolean }> = [
  { id: 'transcript' },
  { id: 'alerts' },
  { id: 'summary' },
  { id: 'export' },
  { id: 'upload', beta: true },
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

/** Foco ciente de Shadow DOM: `document.activeElement` aponta para o host, não para o input
 *  dentro do shadow root — use o activeElement do próprio root. */
function isFocused(el: Element): boolean {
  return (el.getRootNode() as ShadowRoot | Document).activeElement === el;
}

// ---- helpers do histórico ----
function monthAbbr(d: Date): string {
  return d.toLocaleDateString(bcp47(), { month: 'short' }).replace('.', '');
}

function fmtFullDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const wd = d.toLocaleDateString(bcp47(), { weekday: 'long' });
  const date = d.toLocaleDateString(bcp47());
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${date}`;
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}min`;
}

// Rótulos das regras-semente resolvidos por id (o dado salvo pode ter sido criado em outro idioma).
function seedText(w: { id: string; label: string; desc?: string }): { label: string; desc?: string } {
  return seedWatchText(w.id) ?? { label: w.label, desc: w.desc };
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
  // perguntar à reunião (modal de Q&A)
  private askSheet!: HTMLElement;
  private askConvo!: HTMLElement;
  private askInput!: HTMLTextAreaElement;
  private askSendBtn!: HTMLButtonElement;
  private askSubtitleEl!: HTMLElement;
  private askSession: MeetingSession | null = null;
  private askTurns: ChatTurn[] = [];
  private askBusy = false;
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
  private lastAboutOpen = false;
  private histTitleBanner!: HTMLElement;
  private histBulkTitleBusy = false;
  /** Card do histórico com um spinner + rótulo (ex.: "Gerando título…") — para acompanhar
   *  visualmente QUAL reunião está sendo processada durante uma operação em lote. */
  private histProcessingId: string | null = null;
  private histProcessingLabel = '';
  /** Reunião cujo detalhe está aberto agora (null = na lista) — usado pra saber se, ao terminar
   *  um "Gerar resumo/ata"/"Baixar .txt com IA", devemos atualizar o detalhe in-place ou só a
   *  lista (sem puxar o usuário de volta pra uma tela que ele já deixou). */
  private currentDetailMeetingId: string | null = null;
  private histImportInput!: HTMLInputElement;
  private histImportStatus!: HTMLElement;
  // modal de confirmação genérico (ex.: excluir reunião)
  private confirmModal!: HTMLElement;
  private confirmTitleEl!: HTMLElement;
  private confirmMsgEl!: HTMLElement;
  private confirmYesBtn!: HTMLButtonElement;
  private confirmNoBtn!: HTMLButtonElement;
  private confirmResolve: ((v: boolean) => void) | null = null;

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

  private rootRef!: ShadowRoot;
  private container: HTMLElement | null = null;

  mount(root: ShadowRoot) {
    this.rootRef = root;
    this.build();
  }

  private build() {
    const container = el('div', { class: 'ms-root' });
    this.container = container;
    container.append(this.buildCompact(), this.buildPanel(), this.buildAlertOverlay());
    this.rootRef.append(container);

    this.unsub = store.subscribe((s) => this.update(s));

    void this.loadOffset();
    this.enableDrag(this.compact.querySelector('.ms-logo') as HTMLElement);
    this.enableDrag(this.panelHeader);

    this.rtUiTimer = window.setInterval(() => this.rtUiTick(), 1000);
    if (store.get().settings.ollamaUrl) void this.testOllama();
  }

  /** Reconstrói toda a UI (ex.: troca de idioma) preservando o estado no `store`. */
  remount() {
    this.destroy();
    this.container?.remove();
    this.container = null;
    // Limpa caches de nós/assinaturas para que a reconstrução repinte do zero.
    this.chatNodes.clear();
    this.tabBtns.clear();
    this.tabPanels.clear();
    this.addSegBtns.clear();
    this.previewBtns.clear();
    this.lastWatchSig = '';
    this.lastRecentSig = '';
    this.lastVocabSig = ' ';
    this.lastDotKind = '';
    this.lastOvKey = '';
    this.lastHistoryOpen = false;
    this.lastAboutOpen = false;
    this.renderedSummary = '';
    this.rtKey = '';
    this.alertsTabBadge = null;
    this.build();
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
    const c = t().compact;
    const logo = el('div', { class: 'ms-logo', title: c.logoTitle }, [logoImg(34)]);

    const expandBtn = el('button', { class: 'ms-icon-btn', title: c.openPanel, 'aria-label': c.openPanelAria, html: icons.expand });
    expandBtn.addEventListener('click', () => store.patchUi({ expanded: true }));

    this.ccBtn = el('button', { class: 'ms-icon-btn', title: c.captionsToggle, 'aria-label': c.captionsAria, html: icons.captions }) as HTMLButtonElement;
    this.ccBtn.addEventListener('click', () => this.controller.toggleCaptions());

    const dlBtn = el('button', { class: 'ms-icon-btn', title: c.downloadTxt, 'aria-label': c.downloadAria, html: icons.download });
    dlBtn.addEventListener('click', () => this.quickDownload());

    // Sininho de alertas (abre a aba Alertas; mostra estado de arme + não-lidos).
    this.bellIcon = el('span', { class: 'ms-bell-ico', html: icons.ear });
    this.bellBadge = el('span', { class: 'ms-bell-badge ms-hidden' });
    this.bellBtn = el('button', { class: 'ms-icon-btn ms-bell-btn', title: c.alertsBell, 'aria-label': c.alertsAria }, [this.bellIcon, this.bellBadge]) as HTMLButtonElement;
    this.bellBtn.addEventListener('click', () => { store.patchUi({ expanded: true, activeTab: 'alerts' }); store.clearAlertUnread(); });

    this.compactDot = el('span', { class: 'ms-dot' });
    this.compactDotLabel = el('span', { text: c.paused });
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
    this.askSheet = this.buildAskSheet();
    this.confirmModal = this.buildConfirmModal();
    this.panel = el('div', { class: 'ms-panel ms-hidden' }, [header, strip, tabs, body, this.buildFooter(), this.aboutSheet, this.historySheet, this.askSheet, this.confirmModal]);
    return this.panel;
  }

  private buildHeader(): HTMLElement {
    const h = t().header;
    const askBtn = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', title: h.ask, 'aria-label': h.ask, html: icons.chatBubble });
    askBtn.addEventListener('click', () => this.openAsk(store.get().session, store.get().session.meetingTitle || t().ask.title));
    const historyBtn = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', title: h.history, 'aria-label': h.history, html: icons.history });
    historyBtn.addEventListener('click', () => store.patchUi({ historyOpen: true }));
    const aboutBtn = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', title: h.about, 'aria-label': h.aboutAria, html: icons.info });
    aboutBtn.addEventListener('click', () => this.aboutSheet.classList.remove('ms-hidden'));
    const closeBtn = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', title: h.collapse, 'aria-label': h.collapseAria, html: icons.collapse });
    closeBtn.addEventListener('click', () => store.patchUi({ expanded: false }));

    const header = el('div', { class: 'ms-header' }, [
      el('span', { class: 'ms-header-logo' }, [logoImg(26)]),
      el('span', { class: 'ms-wordmark' }, [el('span', { class: 'ms-wm-meet', text: 'Meet' }), el('span', { class: 'ms-wm-sync', text: 'Sync' })]),
      el('span', { class: 'ms-badge', text: h.beta }),
      el('div', { class: 'ms-spacer' }),
      askBtn,
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
      el('div', { class: 'ms-strip-right' }, [el('span', { class: 'ms-strip-label', text: t().statusStrip.captions }), this.captionsToggle.el]),
    ]);
  }

  private buildTabs(): HTMLElement {
    const tabs = el('div', { class: 'ms-tabs' });
    const labels = t().tabs;
    for (const tab of TABS) {
      const btn = el('button', { class: 'ms-tab', type: 'button' }, [el('span', { text: labels[tab.id] })]) as HTMLButtonElement;
      if (tab.beta) btn.append(el('span', { class: 'ms-tab-beta', text: labels.beta }));
      if (tab.id === 'alerts') {
        this.alertsTabBadge = el('span', { class: 'ms-tab-count ms-hidden' });
        btn.append(this.alertsTabBadge);
      }
      btn.append(el('span', { class: 'ms-tab-underline' }));
      btn.addEventListener('click', () => store.patchUi({ activeTab: tab.id }));
      this.tabBtns.set(tab.id, btn);
      tabs.append(btn);
    }
    return tabs;
  }

  // ---------- aba Transcrição ----------
  private buildTranscriptTab(): HTMLElement {
    this.chatList = el('div', { class: 'ms-chat' }, [
      el('div', { class: 'ms-chat-empty', text: t().transcript.empty }),
    ]);
    this.tailStatus = el('span', { class: 'ms-status is-paused' });
    const scroll = el('div', { class: 'ms-tabpanel ms-scroll' }, [this.chatList, el('div', { class: 'ms-tail' }, [this.tailStatus])]);
    scroll.addEventListener('scroll', () => {
      const atBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 50;
      this.autoScroll = atBottom;
      this.jumpBtn.classList.toggle('ms-hidden', atBottom);
    });
    this.transcriptScroll = scroll;

    this.jumpBtn = el('button', { class: 'ms-jump ms-hidden', type: 'button' }, [el('span', { html: icons.download }), el('span', { text: t().transcript.jumpToEnd })]) as HTMLButtonElement;
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
          el('div', { class: 'ms-toggle-main', text: t().summaryTab.rtTitle }),
          el('div', { class: 'ms-toggle-help', text: t().summaryTab.rtHelp }),
        ]),
        this.rtToggle.el,
      ]),
      el('div', { class: 'ms-rt-interval' }, [
        el('span', { class: 'ms-label', text: t().summaryTab.updateEvery }),
        this.intervalPills,
        el('span', { class: 'ms-label', text: t().summaryTab.min }),
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
    const a = t().alerts;
    this.armCard = el('div', { class: 'ms-arm' }, [
      this.armIcon,
      el('div', { class: 'ms-arm-text' }, [el('div', { class: 'ms-arm-title', text: a.monitorTitle }), this.armSub]),
      this.tgArmed.el,
    ]);

    // Som
    this.tgSound = makeToggle((v) => void store.updateSettings({ alertSound: v }));
    this.soundRow = el('div', { class: 'ms-sound-row' }, [el('span', { text: a.playSound }), this.tgSound.el]);

    // Lista de regras
    this.watchesWrap = el('div', { class: 'ms-watches' });

    // Adicionar expressão (segmented + input)
    const seg = el('div', { class: 'ms-alseg' });
    ([['keyword', a.keyword, 'quote'], ['ai', a.aiContext, 'sparkles']] as const).forEach(([m, label, icon]) => {
      const b = el('button', { class: 'ms-alseg-btn', type: 'button' }, [
        el('span', { class: 'ms-alseg-ico', html: icons[icon] }),
        el('span', { text: label }),
      ]) as HTMLButtonElement;
      b.addEventListener('click', () => { this.addMode = m; this.syncAddMode(); });
      this.addSegBtns.set(m, b);
      seg.append(b);
    });
    this.addInput = el('input', { class: 'ms-input', type: 'text', 'aria-label': a.newExprAria }) as HTMLInputElement;
    const addBtn = el('button', { class: 'ms-btn ms-btn-primary ms-btn-sm', type: 'button' }, [
      el('span', { class: 'ms-btn-ico', html: icons.plus }),
      el('span', { text: a.add }),
    ]);
    const submit = () => {
      const v = this.addInput.value.trim();
      if (!v) return;
      const cur = store.get().settings.alertWatches;
      const watch = this.addMode === 'keyword'
        ? { id: cryptoRandomId(), mode: 'keyword' as const, label: a.keywordLabel, terms: v.split(',').map((t) => t.trim()).filter(Boolean), enabled: true }
        : { id: cryptoRandomId(), mode: 'ai' as const, label: a.aiLabel, desc: v, enabled: true };
      void store.updateSettings({ alertWatches: [...cur, watch] });
      this.addInput.value = '';
    };
    addBtn.addEventListener('click', submit);
    this.addInput.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); submit(); } });
    this.addHelp = el('div', { class: 'ms-add-help' });

    // Detecções recentes
    this.recentWrap = el('div', { class: 'ms-recent' });
    this.recentSection = el('div', { class: 'ms-section ms-hidden' }, [this.sectionLabel(a.recentDetections, icons.clock), this.recentWrap]);

    this.syncAddMode();

    const scroll = el('div', { class: 'ms-tabpanel ms-scroll' }, [
      this.armCard,
      this.soundRow,
      el('div', { class: 'ms-section' }, [this.sectionLabel(a.watchedExpr, icons.bell), this.watchesWrap]),
      el('div', { class: 'ms-section' }, [
        this.sectionLabel(a.addExpr, icons.plus),
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
    const a = t().alerts;
    for (const [m, b] of this.addSegBtns) b.classList.toggle('is-sel', m === this.addMode);
    this.addInput.placeholder = this.addMode === 'keyword' ? a.placeholderKeyword : a.placeholderAi;
    this.addHelp.textContent = this.addMode === 'keyword' ? a.helpKeyword : a.helpAi;
  }

  private renderWatches(s: AppState) {
    const ws = s.settings.alertWatches;
    const aiReady = this.ollamaReady(s);
    const armed = s.settings.alertsArmed;
    const sig = JSON.stringify(ws.map((w) => [w.id, w.mode, w.label, w.enabled, (w.terms ?? []).join('|'), w.desc])) + `|${aiReady}|${armed}`;
    if (sig === this.lastWatchSig) return;
    this.lastWatchSig = sig;
    if (!ws.length) {
      this.watchesWrap.replaceChildren(el('div', { class: 'ms-watch-empty', text: t().alerts.noExpr }));
      return;
    }
    this.watchesWrap.replaceChildren(...ws.map((w, i) => this.watchRow(w, i, armed, aiReady)));
  }

  private watchRow(w: AppState['settings']['alertWatches'][number], i: number, armed: boolean, aiReady: boolean): HTMLElement {
    const a = t().alerts;
    const seed = seedText(w);
    const ai = w.mode === 'ai';
    const blocked = ai && !aiReady;

    const iconBox = el('span', { class: 'ms-watch-ico' + (ai ? ' is-ai' : ''), html: icons[ai ? 'sparkles' : 'quote'] });
    const head = el('div', { class: 'ms-watch-label' }, [
      el('span', { text: seed.label }),
      el('span', { class: 'ms-watch-badge', text: ai ? a.badgeAi : a.badgePhrase }),
    ]);
    const body = ai
      ? el('div', { class: 'ms-watch-desc', text: seed.desc ?? '' })
      : el('div', { class: 'ms-watch-terms' }, (w.terms && w.terms.length)
          ? w.terms.map((term) => el('span', { class: 'ms-term', text: term }))
          : [el('div', { class: 'ms-watch-desc', text: a.noTermsYet })]);
    const main: Array<Node> = [head, body];
    if (blocked) {
      main.push(el('div', { class: 'ms-watch-warn' }, [el('span', { class: 'ms-note-ico', html: icons.info }), el('span', { text: a.requiresOllama })]));
    }
    const canSim = armed && !blocked && w.enabled;
    const sim = el('button', { class: 'ms-watch-sim' + (canSim ? '' : ' is-disabled'), type: 'button' }, [
      el('span', { class: 'ms-watch-sim-ico', html: icons.bellRing }),
      el('span', { text: a.simulate }),
    ]);
    if (canSim) sim.addEventListener('click', () => this.controller.simulateAlert(this.demoDetection(w)));
    main.push(sim);

    const tg = makeToggle((v) => void store.updateSettings({
      alertWatches: store.get().settings.alertWatches.map((x) => (x.id === w.id ? { ...x, enabled: v } : x)),
    }));
    tg.setOn(w.enabled);
    tg.setDisabled(blocked);
    const trash = el('button', { class: 'ms-watch-trash', type: 'button', 'aria-label': a.remove, html: icons.trash });
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
    const a = t().alerts;
    const label = seedText(w).label;
    const term = w.terms && w.terms.length ? w.terms[0]! : null;
    return {
      key: 'sim-' + w.id + '-' + Date.now(),
      mode: w.mode,
      label,
      reason: w.mode === 'keyword' ? a.demoReasonKeyword(term ?? label) : a.demoReasonAi(label),
      who: a.demoWho,
      text: w.mode === 'keyword' ? a.demoTextKeyword(term ?? label) : a.demoTextAi,
      t: a.demoTimeNow,
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
    const ov = t().overlay;
    const closeBtn = el('button', { class: 'ms-ov-close', type: 'button', 'aria-label': ov.dismissAria, html: icons.close });
    closeBtn.addEventListener('click', () => store.dismissActiveAlert());

    this.ovAvatar = el('span', { class: 'ms-ov-avatar' });
    this.ovWho = el('span', { class: 'ms-ov-who' });
    this.ovTime = el('span', { class: 'ms-ov-time' });
    this.ovText = el('div', { class: 'ms-ov-text' });

    const goBtn = el('button', { class: 'ms-btn ms-btn-primary ms-btn-block', type: 'button' }, [
      el('span', { class: 'ms-btn-ico', html: icons.video }),
      el('span', { text: ov.goToMeeting }),
    ]);
    goBtn.addEventListener('click', () => { store.dismissActiveAlert(); store.clearAlertUnread(); store.patchUi({ expanded: false }); });
    const dismissBtn = el('button', { class: 'ms-btn ms-btn-ghost', type: 'button', text: ov.dismiss });
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
    this.ovEyebrow.textContent = ai ? t().overlay.detectionAi : t().overlay.meetingAlert;
    this.ovReason.textContent = a.reason;
    this.ovWho.textContent = a.who || '—';
    this.ovTime.textContent = a.t;
    this.ovText.textContent = a.text ? `"${a.text}"` : '';
    this.ovAvatar.replaceChildren(el('span', { text: initials(a.who || '?') }));
    this.ovAvatar.style.background = avatarColor(a.who || '?');
  }


  // ---------- aba Exportar ----------
  private buildExportTab(): HTMLElement {
    const x = t().exportTab;
    this.tgAutoStart = toggleRow({ label: x.autoStart, desc: x.autoStartDesc, onChange: (v) => void store.updateSettings({ autoEnableCaptions: v }) });
    this.tgAutoChat = toggleRow({ label: x.autoChat, desc: x.autoChatDesc, onChange: (v) => void store.updateSettings({ autoOpenChat: v }) });
    this.tgHeader = toggleRow({ label: x.header, desc: x.headerDesc, onChange: (v) => void store.updateSettings({ includeHeaderByDefault: v }).then(() => this.refreshPreview()) });
    this.tgCorrect = toggleRow({ label: x.correct, desc: x.correctDesc, onChange: (v) => void store.updateSettings({ enableAiCorrection: v }) });
    this.tgSummary = toggleRow({ label: x.summary, desc: x.summaryDesc, onChange: (v) => void store.updateSettings({ includeSummary: v }) });
    this.tgSeparate = toggleRow({ label: x.separate, desc: x.separateDesc, onChange: (v) => void store.updateSettings({ separateSummaryFile: v }) });
    this.tgJson = toggleRow({ label: x.json, desc: x.jsonDesc, onChange: (v) => void store.updateSettings({ exportJson: v }) });

    // Seletor de idioma — troca UI + exportações + IA, e re-renderiza o painel.
    const langField = el('div', { class: 'ms-section' }, [
      this.sectionLabel(x.language, icons.sync),
      this.buildLanguageSelect(),
      el('div', { class: 'ms-vocab-desc ms-mt-2', text: x.languageDesc }),
    ]);

    // Ollama
    this.ollamaUrlInput = el('input', { class: 'ms-input', type: 'text', placeholder: 'http://localhost:11434', 'aria-label': x.ollamaUrlAria }) as HTMLInputElement;
    this.ollamaUrlInput.addEventListener('change', () => {
      const clean = normalizeOllamaUrl(this.ollamaUrlInput.value);
      this.ollamaUrlInput.value = clean;
      void store.updateSettings({ ollamaUrl: clean });
    });
    const testBtn = el('button', { class: 'ms-btn ms-btn-secondary ms-btn-sm', type: 'button', text: x.test });
    testBtn.addEventListener('click', () => this.testOllama());
    this.ollamaStatusEl = el('div', { class: 'ms-status is-idle' });
    this.modelPills = el('div', { class: 'ms-pill-group ms-pill-wrap' });

    // Vocabulário do negócio (termos injetados nos prompts de correção/resumo).
    this.vocabInput = el('input', { class: 'ms-input', type: 'text', placeholder: x.vocabPlaceholder, 'aria-label': x.vocabNewAria }) as HTMLInputElement;
    const vocabAdd = el('button', { class: 'ms-btn ms-btn-secondary ms-btn-sm', type: 'button' }, [el('span', { class: 'ms-btn-ico', html: icons.plus }), el('span', { text: x.vocabAdd })]);
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
      this.sectionLabel(x.vocabTitle, icons.tag),
      el('div', { class: 'ms-vocab-desc', html: x.vocabDescHtml }),
      this.vocabWrap,
      el('div', { class: 'ms-row-gap ms-mt-2' }, [el('div', { class: 'ms-grow' }, [this.vocabInput]), vocabAdd]),
      this.vocabNote,
    ]);

    const ollamaSection = el('div', { class: 'ms-section' }, [
      this.sectionLabel(x.ollamaTitle, icons.sync),
      el('label', { class: 'ms-label', text: x.serverUrl }),
      el('div', { class: 'ms-row-gap' }, [el('div', { class: 'ms-grow' }, [this.ollamaUrlInput]), testBtn]),
      el('div', { class: 'ms-mt-2' }, [this.ollamaStatusEl]),
      el('label', { class: 'ms-label ms-mt-3', text: x.model }),
      this.modelPills,
      el('div', { class: 'ms-privacy' }, [
        el('span', { class: 'ms-note-ico', html: icons.lock }),
        el('span', { text: x.ollamaPrivacy }),
      ]),
    ]);

    // Preview com sub-abas
    this.preview = el('pre', { class: 'ms-preview ms-scroll' });
    this.previewName = el('div', { class: 'ms-preview-name' });
    const seg = el('div', { class: 'ms-segmented' });
    (['txt', 'ata'] as const).forEach((k) => {
      const b = el('button', { class: 'ms-seg' + (k === 'txt' ? ' is-sel' : ''), type: 'button', text: k === 'txt' ? x.previewTranscript : x.previewSummary }) as HTMLButtonElement;
      b.addEventListener('click', () => { this.previewMode = k; this.previewBtns.forEach((bb, kk) => bb.classList.toggle('is-sel', kk === k)); this.refreshPreview(); });
      this.previewBtns.set(k, b);
      seg.append(b);
    });
    const previewSection = el('div', { class: 'ms-section' }, [
      el('div', { class: 'ms-section-head' }, [this.sectionLabel(x.preview, icons.doc), seg]),
      this.preview,
      this.previewName,
    ]);

    // "Seu nome": substitui "Você" na transcrição/exportações/resumos.
    this.selfNameInput = el('input', { class: 'ms-input', type: 'text', placeholder: x.yourNamePlaceholder, 'aria-label': x.yourName }) as HTMLInputElement;
    this.selfNameInput.addEventListener('change', () => {
      const v = this.selfNameInput.value.trim();
      void store.updateSettings({ selfName: v });
      store.relabelSelf(v); // reaplica às falas já capturadas como "Você"
      this.lastRtSig = ''; // força regenerar o resumo em tempo real com o nome novo
    });
    const selfNameField = el('div', { class: 'ms-section' }, [
      this.sectionLabel(x.yourName, icons.people),
      this.selfNameInput,
      el('div', { class: 'ms-vocab-desc ms-mt-2', text: x.yourNameDesc }),
    ]);

    const scroll = el('div', { class: 'ms-tabpanel ms-scroll' }, [
      langField,
      el('div', { class: 'ms-section' }, [this.sectionLabel(x.capturePrefs, icons.clock), this.tgAutoStart.root, this.tgAutoChat.root]),
      selfNameField,
      el('div', { class: 'ms-section' }, [this.sectionLabel(x.exportOptions, icons.settings), this.tgHeader.root, this.tgCorrect.root, this.tgSummary.root, this.tgSeparate.root, this.tgJson.root]),
      vocabSection,
      ollamaSection,
      previewSection,
    ]);
    this.tabPanels.set('export', scroll);
    return scroll;
  }

  /** <select> de idioma: troca o locale, persiste e reconstrói o painel. */
  private buildLanguageSelect(): HTMLElement {
    const names = t().langName;
    const sel = el('select', { class: 'ms-input ms-lang-select', 'aria-label': t().exportTab.language }) as HTMLSelectElement;
    for (const loc of LOCALES) {
      const opt = el('option', { value: loc, text: names[loc] }) as HTMLOptionElement;
      if (loc === getLocale()) opt.selected = true;
      sel.append(opt);
    }
    sel.addEventListener('change', () => {
      const next = sel.value as Locale;
      if (next === getLocale()) return;
      void store.updateSettings({ locale: next });
      this.remount();
    });
    return sel;
  }

  private renderVocab(s: AppState) {
    const vocab = s.settings.vocabulary;
    const active = (s.settings.enableAiCorrection || s.settings.includeSummary) && this.ollamaReady(s);
    this.vocabNote.className = 'ms-vocab-note' + (active ? ' is-active' : '');
    this.vocabNote.replaceChildren(
      el('span', { class: 'ms-note-ico', html: active ? icons.checkCircle : icons.info }),
      el('span', {
        text: active ? t().exportTab.vocabAppliedActive(vocab.length) : t().exportTab.vocabAppliedInactive,
      }),
    );
    const sig = vocab.join('');
    if (sig === this.lastVocabSig) return;
    this.lastVocabSig = sig;
    if (!vocab.length) {
      this.vocabWrap.replaceChildren(el('div', { class: 'ms-vocab-empty', text: t().exportTab.vocabEmpty }));
      return;
    }
    this.vocabWrap.replaceChildren(
      ...vocab.map((term) => {
        const chip = el('span', { class: 'ms-vocab-chip' }, [el('span', { text: term })]);
        const rm = el('button', { class: 'ms-vocab-x', type: 'button', 'aria-label': `${t().alerts.remove} ${term}`, title: t().alerts.remove, html: icons.close });
        rm.addEventListener('click', () => void store.updateSettings({ vocabulary: store.get().settings.vocabulary.filter((v) => v !== term) }));
        chip.append(rm);
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
    const u = t().upload;
    const provider = el('div', { class: 'ms-segmented ms-seg-block' }, [
      el('button', { class: 'ms-seg is-sel', type: 'button', text: u.providerS3, disabled: true }),
      el('button', { class: 'ms-seg', type: 'button', text: u.providerMinio, disabled: true }),
    ]);
    const sendToggle = (label: string, desc: string) => {
      const tg = makeToggle(() => {});
      tg.setDisabled(true);
      return el('div', { class: 'ms-toggle-row is-disabled' }, [
        el('div', { class: 'ms-toggle-labels' }, [el('div', { class: 'ms-toggle-main', text: label }), el('div', { class: 'ms-toggle-help', text: desc })]),
        tg.el,
      ]);
    };
    const sendBtn = el('button', { class: 'ms-btn ms-btn-primary ms-btn-block', type: 'button', text: u.sendNow, disabled: true });

    const form = el('div', { class: 'ms-upload-form' }, [
      el('div', { class: 'ms-purpose' }, [
        el('span', { class: 'ms-note-ico', html: icons.database }),
        el('span', { text: u.purpose }),
      ]),
      this.sectionLabel(u.bucketDest, icons.database),
      provider,
      this.uploadField(u.endpoint, 'http://localhost:9000', true),
      el('div', { class: 'ms-row-gap' }, [this.uploadField(u.region, 'us-east-1', true), this.uploadField(u.bucket, 'meetsync', true)]),
      this.uploadField(u.accessKey, 'AKIA… / minioadmin', true),
      this.uploadField(u.secretKey, '••••••••••••', true),
      this.uploadField(u.prefix, u.prefixPlaceholder, true),
      el('div', { class: 'ms-section ms-mt-3b' }, [
        this.sectionLabel(u.whatToSend, icons.doc),
        sendToggle(u.sendTxt, u.sendTxtDesc),
        sendToggle(u.sendAta, u.sendAtaDesc),
        sendToggle(u.sendJson, u.sendJsonDesc),
        sendToggle(u.sendAuto, u.sendAutoDesc),
      ]),
      el('div', { class: 'ms-mt-3b' }, [sendBtn]),
    ]);

    const scroll = el('div', { class: 'ms-tabpanel ms-scroll' }, [
      el('div', { class: 'ms-locked' }, [
        el('span', { class: 'ms-note-ico', html: icons.lock }),
        el('div', {}, [
          el('div', { class: 'ms-locked-title' }, [el('span', { text: u.lockedTitle }), el('span', { class: 'ms-badge', text: u.lockedBadge })]),
          el('div', { class: 'ms-locked-desc', text: u.lockedDesc }),
        ]),
      ]),
      el('div', { class: 'ms-upload-preview' }, [form]),
    ]);
    this.tabPanels.set('upload', scroll);
    return scroll;
  }

  private buildFooter(): HTMLElement {
    this.downloadBtn = el('button', { class: 'ms-btn ms-btn-primary ms-grow', type: 'button', text: t().footer.downloadTxt }) as HTMLButtonElement;
    this.downloadBtn.addEventListener('click', () => this.fullDownload());
    this.downloadRawBtn = el('button', { class: 'ms-btn ms-btn-secondary ms-hidden', type: 'button', title: t().footer.downloadWithoutAi, text: t().footer.downloadTxtShort }) as HTMLButtonElement;
    this.downloadRawBtn.addEventListener('click', () => this.quickDownload());
    this.footer = el('div', { class: 'ms-footer' }, [el('div', { class: 'ms-btn-row' }, [this.downloadBtn, this.downloadRawBtn])]);
    return this.footer;
  }

  private buildAbout(): HTMLElement {
    const ab = t().about;
    const back = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', title: t().header.back, 'aria-label': t().header.back, html: icons.chevronLeft });
    const sheet = el('div', { class: 'ms-about ms-hidden' }, [
      el('div', { class: 'ms-about-head' }, [back, el('span', { class: 'ms-about-title', text: ab.title })]),
      el('div', { class: 'ms-about-body ms-scroll' }, [
        el('div', { class: 'ms-about-logo' }, [logoImg(72)]),
        el('span', { class: 'ms-wordmark ms-wordmark-lg' }, [el('span', { class: 'ms-wm-meet', text: 'Meet' }), el('span', { class: 'ms-wm-sync', text: 'Sync' })]),
        el('div', { class: 'ms-about-ver', text: ab.version(chrome.runtime.getManifest().version) }),
        el('p', { class: 'ms-about-desc', text: ab.desc }),
        el('div', { class: 'ms-about-sep' }),
        el('div', { class: 'ms-section-title', text: ab.devBy }),
        (() => { const a = el('a', { class: 'ms-btn ms-btn-primary ms-btn-block', href: 'https://devsync.com.br', target: '_blank', rel: 'noopener noreferrer', text: 'devsync.com.br' }); return a; })(),
        el('div', { class: 'ms-about-priv', text: ab.privacy }),
      ]),
    ]);
    back.addEventListener('click', () => {
      sheet.classList.add('ms-hidden');
      this.lastAboutOpen = false;
      const s = store.get();
      if (s.ui.aboutOpen) {
        // Só entra aqui quando o "Sobre" foi aberto pelo popup (aboutOpen no store), que força
        // o painel visível (review+expanded) mesmo sem reunião. Sem isso, fechar o "Sobre"
        // revelava o corpo padrão do painel por baixo — parecendo uma reunião em captura.
        if (s.ui.review && !s.inMeeting && !s.ended && !s.ui.historyOpen) {
          store.patchUi({ aboutOpen: false, review: false, expanded: false });
        } else {
          store.patchUi({ aboutOpen: false });
        }
      }
    });
    return sheet;
  }

  private sectionLabel(text: string, icon: string): HTMLElement {
    return el('div', { class: 'ms-section-label' }, [el('span', { class: 'ms-sl-ico', html: icon }), el('span', { text })]);
  }

  // ================= Perguntar à reunião (modal de Q&A) =================
  private buildAskSheet(): HTMLElement {
    const a = t().ask;
    const back = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', type: 'button', title: t().header.back, 'aria-label': t().header.back, html: icons.chevronLeft });
    this.askSubtitleEl = el('div', { class: 'ms-ask-sub', text: a.subtitle });
    this.askConvo = el('div', { class: 'ms-ask-convo ms-scroll' });

    this.askInput = el('textarea', { class: 'ms-ask-input', rows: '1', placeholder: a.placeholder, 'aria-label': a.title }) as HTMLTextAreaElement;
    this.askInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void this.sendAsk(); }
    });
    this.askSendBtn = el('button', { class: 'ms-icon-btn ms-ask-send', type: 'button', title: a.send, 'aria-label': a.send, html: icons.chevronRight }) as HTMLButtonElement;
    this.askSendBtn.addEventListener('click', () => void this.sendAsk());

    const sheet = el('div', { class: 'ms-ask ms-hidden' }, [
      el('div', { class: 'ms-ask-head' }, [
        back,
        el('div', { class: 'ms-ask-titlewrap' }, [el('div', { class: 'ms-ask-title', text: a.title }), this.askSubtitleEl]),
      ]),
      this.askConvo,
      el('div', { class: 'ms-ask-inputrow' }, [this.askInput, this.askSendBtn]),
    ]);
    back.addEventListener('click', () => { this.askSheet.classList.add('ms-hidden'); });
    return sheet;
  }

  /** Abre o modal de Q&A para uma sessão (reunião ao vivo ou do histórico). */
  private openAsk(session: MeetingSession, title: string) {
    this.askSession = session;
    this.askTurns = [];
    this.askSubtitleEl.textContent = title;
    this.renderAskEmpty();
    this.askInput.value = '';
    this.askSheet.classList.remove('ms-hidden');
    setTimeout(() => this.askInput.focus(), 60);
  }

  private renderAskEmpty() {
    const a = t().ask;
    const chip = (text: string) => {
      const c = el('button', { class: 'ms-ask-ex', type: 'button', text }) as HTMLButtonElement;
      c.addEventListener('click', () => { this.askInput.value = text; this.askInput.focus(); });
      return c;
    };
    this.askConvo.replaceChildren(
      el('div', { class: 'ms-ask-empty' }, [
        el('span', { class: 'ms-ask-empty-ico', html: icons.chatBubble }),
        el('div', { class: 'ms-ask-empty-title', text: a.emptyTitle }),
        el('div', { class: 'ms-ask-empty-desc', text: a.emptyDesc }),
        el('div', { class: 'ms-ask-ex-row' }, [chip(a.ex1), chip(a.ex2), chip(a.ex3)]),
      ]),
    );
  }

  private askScrollDown() {
    this.askConvo.scrollTop = this.askConvo.scrollHeight;
  }

  private async sendAsk() {
    const a = t().ask;
    const q = this.askInput.value.trim();
    if (!q || this.askBusy || !this.askSession) return;
    const s = store.get();
    if (!this.ollamaReady(s)) { this.askAppendNote(a.requiresOllama); return; }
    if (this.askSession.transcript.length === 0) { this.askAppendNote(a.noTranscript); return; }

    if (this.askTurns.length === 0) this.askConvo.replaceChildren(); // limpa o estado vazio
    this.askInput.value = '';
    this.askConvo.append(el('div', { class: 'ms-ask-msg is-user' }, [el('div', { class: 'ms-ask-bubble', text: q })]));
    const aiBody = el('div', { class: 'ms-ask-bubble ms-summary' });
    this.askConvo.append(el('div', { class: 'ms-ask-msg is-ai' }, [aiBody]));
    aiBody.append(el('span', { class: 'ms-ask-typing' }, [el('span', {}), el('span', {}), el('span', {})]));
    this.askScrollDown();

    this.askBusy = true; this.askSendBtn.disabled = true;
    const history = [...this.askTurns];
    try {
      const ans = await askMeetingStream(
        this.askSession, s.settings.ollamaUrl, s.settings.ollamaModel!, history, q,
        (acc) => { if (acc.trim()) renderMarkdownInto(aiBody, acc, true); this.askScrollDown(); },
        s.settings.vocabulary,
      );
      renderMarkdownInto(aiBody, ans);
      this.askTurns.push({ role: 'user', content: q }, { role: 'assistant', content: ans });
      this.askScrollDown();
    } catch {
      aiBody.classList.remove('ms-summary');
      aiBody.textContent = a.error;
    } finally {
      this.askBusy = false; this.askSendBtn.disabled = false; this.askInput.focus();
    }
  }

  private askAppendNote(text: string) {
    this.askConvo.append(el('div', { class: 'ms-ask-systemnote', text }));
    this.askScrollDown();
  }

  // ================= Histórico de reuniões (sheet) =================
  private buildHistorySheet(): HTMLElement {
    // --- lista ---
    const hi = t().history;
    const back = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', type: 'button', title: t().header.back, 'aria-label': t().header.back, html: icons.chevronLeft });
    back.addEventListener('click', () => this.closeHistory());
    const aboutBtn = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', type: 'button', title: t().header.about, 'aria-label': t().header.aboutAria, html: icons.info });
    aboutBtn.addEventListener('click', () => this.aboutSheet.classList.remove('ms-hidden'));
    this.histCount = el('span', { class: 'ms-hist-count' });
    this.histSearch = el('input', { class: 'ms-input', type: 'text', placeholder: hi.searchPlaceholder, 'aria-label': hi.searchAria }) as HTMLInputElement;
    this.histSearch.addEventListener('input', () => { this.histQuery = this.histSearch.value; this.renderHistoryList(); });

    this.histImportInput = el('input', { type: 'file', accept: '.json,application/json', class: 'ms-hidden' }) as HTMLInputElement;
    this.histImportInput.addEventListener('change', () => void this.handleImportFile());
    const importBtn = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', type: 'button', title: hi.importAction, 'aria-label': hi.importAction, html: icons.importFile });
    importBtn.addEventListener('click', () => this.histImportInput.click());

    this.histTitleBanner = el('div', { class: 'ms-hist-ai-banner ms-hidden' });
    this.histImportStatus = el('div', { class: 'ms-hist-import-status ms-hidden' });

    this.histList = el('div', { class: 'ms-hist-list' });
    this.histListView = el('div', { class: 'ms-hist-view' }, [
      el('div', { class: 'ms-hist-head' }, [back, el('span', { class: 'ms-hist-title', text: hi.title }), this.histCount, aboutBtn]),
      el('div', { class: 'ms-hist-search ms-hist-search-row' }, [this.histSearch, importBtn, this.histImportInput]),
      el('div', { class: 'ms-hist-scroll ms-scroll' }, [
        this.histTitleBanner,
        this.histImportStatus,
        this.histList,
        el('div', { class: 'ms-hist-privacy' }, [
          el('span', { class: 'ms-note-ico', html: icons.lock }),
          el('span', { text: hi.privacy }),
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
    this.currentDetailMeetingId = null;
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
      el('span', { text: t().history.count(n) }),
    );
    this.renderHistTitleBanner();
    if (!list.length) {
      this.histList.replaceChildren(
        el('div', { class: 'ms-hist-empty' }, [
          el('span', { class: 'ms-hist-empty-ico', html: icons.history }),
          el('span', { text: this.histMetas.length ? t().history.notFound : t().history.empty }),
        ]),
      );
      return;
    }
    this.histList.replaceChildren(...list.map((m) => this.historyCard(m, m.id === this.histProcessingId ? this.histProcessingLabel : undefined)));
  }

  private historyCard(m: HistoryMeta, processingLabel?: string): HTMLElement {
    const when = m.startISO ?? m.savedAt;
    const d = new Date(when);
    const dateTile = processingLabel
      ? el('div', { class: 'ms-hist-tile ms-hist-tile-busy' }, [el('span', { class: 'ms-spinner' })])
      : el('div', { class: 'ms-hist-tile' }, [
          el('span', { class: 'ms-hist-tile-day', text: isNaN(d.getTime()) ? '–' : String(d.getDate()) }),
          el('span', { class: 'ms-hist-tile-mon', text: isNaN(d.getTime()) ? '' : monthAbbr(d) }),
        ]);

    const isTeams = m.provider === 'microsoft-teams';
    const provIcon = isTeams ? icons.provTeams : icons.provMeet;
    const provName = isTeams ? 'Microsoft Teams' : 'Google Meet';
    const titleRow = el('div', { class: 'ms-hist-c-titlerow' }, [
      el('span', { class: `ms-hist-prov ${isTeams ? 'is-teams' : 'is-meet'}`, title: provName, 'aria-label': provName, html: provIcon }),
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
    if (processingLabel) {
      children.push(
        el('div', { class: 'ms-hist-c-processing' }, [
          el('span', { class: 'ms-spinner ms-spinner-sm' }),
          el('span', { text: processingLabel }),
        ]),
      );
    } else if (m.preview) {
      children.push(
        el('div', { class: 'ms-hist-c-preview' }, [
          el('span', { class: 'ms-hist-c-pwho', text: `${m.preview.who.split(' ')[0]}:` }),
          el('span', { text: ` ${m.preview.text}` }),
        ]),
      );
    }
    children.push(
      el('div', { class: 'ms-hist-c-chips' }, [
        metaChip(icons.people, t().history.people(m.participants.length)),
        metaChip(icons.chatBubble, t().history.lines(m.lines)),
        m.hasSummary ? metaChip(icons.doc, t().history.withAta, true) : metaChip(icons.doc, t().history.withoutAta),
        el('span', { class: 'ms-hist-c-spacer' }),
        metaChip(icons.cloudUp, t().history.local),
      ]),
    );

    const card = el('button', { class: 'ms-hist-card' + (processingLabel ? ' is-processing' : ''), type: 'button', ...(processingLabel ? { disabled: true } : {}) }, children);
    if (!processingLabel) card.addEventListener('click', () => void this.openDetail(m));
    return card;
  }

  private async openDetail(m: HistoryMeta) {
    const saved = await loadMeeting(m.id);
    if (!saved) { void this.refreshHistory(); return; }
    this.currentDetailMeetingId = m.id;
    const session = saved.session;
    const summaryText = saved.summaryText;

    const hi = t().history;
    const back = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', type: 'button', title: t().header.back, 'aria-label': t().header.back, html: icons.chevronLeft });
    back.addEventListener('click', () => {
      this.currentDetailMeetingId = null;
      this.renderHistoryList();
      this.histDetailView.classList.add('ms-hidden');
      this.histListView.classList.remove('ms-hidden');
    });

    const star = el('button', { class: 'ms-icon-btn ms-icon-btn-sm ms-hist-d-star' + (m.starred ? ' is-on' : ''), type: 'button', title: hi.favorite, 'aria-label': hi.favorite, html: m.starred ? icons.starFill : icons.star });
    star.addEventListener('click', () => void (async () => {
      m.starred = !m.starred;
      star.innerHTML = m.starred ? icons.starFill : icons.star;
      star.classList.toggle('is-on', m.starred);
      await setMeetingStarred(m.id, m.starred);
      this.histMetas = await loadHistory();
    })());

    const isTeams = m.provider === 'microsoft-teams';
    const provIcon = isTeams ? icons.provTeams : icons.provMeet;
    const provName = isTeams ? 'Microsoft Teams' : 'Google Meet';
    const head = el('div', { class: 'ms-hist-head' }, [
      back,
      el('div', { class: 'ms-hist-d-titlewrap' }, [
        el('div', { class: 'ms-hist-d-titlerow' }, [
          el('span', { class: `ms-hist-prov ${isTeams ? 'is-teams' : 'is-meet'}`, title: provName, 'aria-label': provName, html: provIcon }),
          el('div', { class: 'ms-hist-title', text: m.title }),
        ]),
        el('div', { class: 'ms-hist-d-sub', text: `${provName} · ${fmtFullDate(m.startISO ?? m.savedAt)} · ${m.startISO ? formatTime(m.startISO) : ''}${m.endISO ? '–' + formatTime(m.endISO) : ''}` }),
      ]),
      star,
    ]);

    // métricas
    const strip = el('div', { class: 'ms-hist-d-strip' }, [
      el('div', { class: 'ms-hist-d-stat' }, [el('div', { class: 'ms-hist-d-statk', text: hi.duration }), el('div', { class: 'ms-hist-d-statv', text: fmtDuration(m.durationMin) })]),
      el('div', { class: 'ms-hist-d-stat' }, [el('div', { class: 'ms-hist-d-statk', text: hi.linesChat }), el('div', { class: 'ms-hist-d-statv' }, [el('span', { text: String(m.lines) }), el('span', { class: 'ms-hist-d-statsub', text: hi.chatSuffix(m.chats) })])]),
    ]);

    // participantes
    const people = el('div', { class: 'ms-hist-d-people' }, [avatarStack(m.participants, 6), el('span', { class: 'ms-hist-d-pcount', text: hi.people(m.participants.length) })]);

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
          el('div', { class: 'ms-hist-pv-foot', text: hi.previewFoot(m.lines) }),
        );
      } else {
        const box = el('div', { class: 'ms-hist-pv-summary ms-summary' });
        if (summaryText) renderMarkdownInto(box, summaryText);
        else box.textContent = hi.noAtaGenerated;
        previewBox.replaceChildren(box);
      }
    };
    const seg = el('div', { class: 'ms-hist-d-seg' });
    ([['transcript', t().tabs.transcript], ['summary', t().tabs.summary]] as const).forEach(([k, label]) => {
      const dis = k === 'summary' && !summaryText;
      const b = el('button', { class: 'ms-hist-seg-btn', type: 'button', text: label }) as HTMLButtonElement;
      if (dis) b.classList.add('is-disabled');
      else b.addEventListener('click', () => { view = k; renderPreview(); });
      segBtns.set(k, b);
      seg.append(b);
    });

    // ações
    const aiReady = this.ollamaReady(store.get());
    const askAct = this.histAction(icons.chatBubble, t().ask.historyAction, aiReady ? t().ask.historyActionSub : hi.dlAiSubNoOllama, !aiReady, () => this.openAsk(session, m.title));
    const dlTxt = this.histAction(icons.download, hi.dlTxt, hi.dlTxtSub, false, () =>
      downloadText(buildFilename(session), buildTxt(session, { includeHeader: true })),
    );
    let aiBusy = false;
    const dlAi = this.histAction(icons.sparkles, hi.dlAi, aiReady ? hi.dlAiSub : hi.dlAiSubNoOllama, !aiReady, () => void (async () => {
      if (aiBusy) return;
      aiBusy = true;
      const labelEl = dlAi.querySelector('.ms-hist-action-label');
      const subEl = dlAi.querySelector('.ms-hist-action-sub');
      const icoEl = dlAi.querySelector('.ms-hist-action-ico');
      const prevLabel = labelEl?.textContent ?? '';
      const prevSub = subEl?.textContent ?? '';
      const prevIco = icoEl?.innerHTML ?? '';
      dlAi.classList.add('is-disabled');
      if (labelEl) labelEl.textContent = hi.dlAiBusy;
      if (subEl) subEl.textContent = hi.dlAiBusySub;
      if (icoEl) icoEl.innerHTML = '<span class="ms-spinner"></span>';
      // Marca esta reunião como "em processamento" pra lista mostrar o spinner no card dela
      // caso o usuário volte pro histórico antes de terminar.
      this.histProcessingId = m.id;
      this.histProcessingLabel = hi.dlAiBusy;
      try {
        const { summaryGeneratedNow } = await this.aiExport(session, { correct: true, summary: store.get().settings.includeSummary, existingSummary: summaryText });
        if (summaryGeneratedNow) {
          this.histMetas = await loadHistory();
          const fresh = this.histMetas.find((x) => x.id === m.id) ?? m;
          if (this.currentDetailMeetingId === m.id) {
            // Ainda olhando pra essa reunião — reabre pra refletir "Com ata" no botão/segmentado.
            void this.openDetail(fresh);
          } else {
            // Usuário já saiu pra outra tela — só atualiza a lista, sem puxá-lo de volta.
            this.histProcessingId = null;
            this.renderHistoryList();
          }
          return;
        }
      } finally {
        aiBusy = false;
        dlAi.classList.remove('is-disabled');
        if (labelEl) labelEl.textContent = prevLabel;
        if (subEl) subEl.textContent = prevSub;
        if (icoEl) icoEl.innerHTML = prevIco;
        if (this.histProcessingId === m.id) { this.histProcessingId = null; this.renderHistoryList(); }
      }
    })());
    const genAta = this.histAction(
      icons.sparkles,
      hi.genAta,
      summaryText ? hi.genAtaSubDone : aiReady ? hi.genAtaSub : hi.dlAiSubNoOllama,
      !aiReady || !!summaryText,
      () => void (async () => {
        const s = store.get().settings;
        const labelEl = genAta.querySelector('.ms-hist-action-label');
        const subEl = genAta.querySelector('.ms-hist-action-sub');
        const icoEl = genAta.querySelector('.ms-hist-action-ico');
        const prevLabel = labelEl?.textContent ?? '';
        const prevSub = subEl?.textContent ?? '';
        const prevIco = icoEl?.innerHTML ?? '';
        genAta.classList.add('is-disabled');
        if (labelEl) labelEl.textContent = hi.genAtaBusy;
        if (icoEl) icoEl.innerHTML = '<span class="ms-spinner"></span>';
        // Marca esta reunião como "em processamento" pra lista mostrar o spinner no card dela
        // caso o usuário volte pro histórico antes de terminar.
        this.histProcessingId = m.id;
        this.histProcessingLabel = hi.genAtaBusy;
        try {
          const text = await summarizeMeeting(session, s.ollamaUrl, s.ollamaModel!, s.vocabulary);
          await updateMeetingSummary(session.id, text);
          this.histMetas = await loadHistory();
          const fresh = this.histMetas.find((x) => x.id === m.id) ?? m;
          if (this.currentDetailMeetingId === m.id) {
            // Ainda olhando pra essa reunião — reabre pra habilitar a aba Resumo e "Baixar ata".
            void this.openDetail(fresh);
          } else {
            // Usuário já saiu pra outra tela — só atualiza a lista, sem puxá-lo de volta.
            this.histProcessingId = null;
            this.renderHistoryList();
          }
          return;
        } catch (err) {
          store.patchOllama({ lastError: t().ollamaStatus.summaryFailed(err instanceof Error ? err.message : String(err)) });
        } finally {
          genAta.classList.remove('is-disabled');
          if (labelEl) labelEl.textContent = prevLabel;
          if (subEl) subEl.textContent = prevSub;
          if (icoEl) icoEl.innerHTML = prevIco;
          if (this.histProcessingId === m.id) { this.histProcessingId = null; this.renderHistoryList(); }
        }
      })(),
    );
    const dlAta = this.histAction(icons.doc, hi.dlAta, summaryText ? hi.dlAtaSubYes : hi.dlAtaSubNo, !summaryText, () => {
      if (summaryText) downloadText(buildFilename(session, t().exportFile.filenameSummarySuffix), buildSummaryTxt(session, summaryText));
    });
    const exportBackup = this.histAction(icons.exportFile, hi.exportBackup, hi.exportBackupSub, false, () =>
      downloadText(buildFilename(session, '_backup', 'json'), buildMeetingBackup(m, saved)),
    );
    const del = this.histAction(icons.trash, hi.del, hi.delSub, false, () => void (async () => {
      const ok = await this.confirmDialog(hi.deleteConfirmTitle, hi.deleteConfirmMsg, hi.deleteConfirmYes, hi.deleteConfirmNo);
      if (!ok) return;
      await deleteMeeting(m.id);
      this.histDetailView.classList.add('ms-hidden');
      this.histListView.classList.remove('ms-hidden');
      void this.refreshHistory();
    })(), true);

    const scroll = el('div', { class: 'ms-hist-scroll ms-scroll' }, [
      strip,
      this.sectionLabel(hi.participants, icons.people),
      people,
      seg,
      previewBox,
      this.sectionLabel(hi.actionsAi, icons.sparkles),
      el('div', { class: 'ms-hist-actions' }, [askAct, dlAi, genAta]),
      this.sectionLabel(hi.actionsExport, icons.download),
      el('div', { class: 'ms-hist-actions' }, [dlTxt, dlAta, exportBackup]),
      el('div', { class: 'ms-hist-actions' }, [del]),
    ]);

    renderPreview();
    this.histDetailView.replaceChildren(head, scroll);
    this.histListView.classList.add('ms-hidden');
    this.histDetailView.classList.remove('ms-hidden');
  }

  private histAction(icon: string, label: string, sub: string, disabled: boolean, onClick: () => void, danger = false): HTMLElement {
    const row = el('button', { class: 'ms-hist-action' + (danger ? ' is-danger' : '') + (disabled ? ' is-disabled' : ''), type: 'button', title: `${label} — ${sub}` }, [
      el('span', { class: 'ms-hist-action-ico', html: icon }),
      el('div', { class: 'ms-hist-action-body' }, [el('div', { class: 'ms-hist-action-label', text: label }), el('div', { class: 'ms-hist-action-sub', text: sub })]),
      ...(danger ? [] : [el('span', { class: 'ms-hist-action-chev', html: icons.chevronRight })]),
    ]);
    if (!disabled) row.addEventListener('click', onClick);
    return row;
  }

  // ================= Modal de confirmação genérico (ex.: excluir reunião) =================
  private buildConfirmModal(): HTMLElement {
    this.confirmTitleEl = el('div', { class: 'ms-confirm-title' });
    this.confirmMsgEl = el('div', { class: 'ms-confirm-msg' });
    this.confirmYesBtn = el('button', { class: 'ms-btn ms-btn-danger', type: 'button' }) as HTMLButtonElement;
    this.confirmNoBtn = el('button', { class: 'ms-btn ms-btn-secondary', type: 'button' }) as HTMLButtonElement;
    this.confirmYesBtn.addEventListener('click', () => this.resolveConfirm(true));
    this.confirmNoBtn.addEventListener('click', () => this.resolveConfirm(false));
    const card = el('div', { class: 'ms-confirm-card' }, [
      this.confirmTitleEl,
      this.confirmMsgEl,
      el('div', { class: 'ms-confirm-actions' }, [this.confirmNoBtn, this.confirmYesBtn]),
    ]);
    const overlay = el('div', { class: 'ms-confirm-overlay ms-hidden' }, [card]);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.resolveConfirm(false); });
    return overlay;
  }

  private resolveConfirm(v: boolean) {
    this.confirmModal.classList.add('ms-hidden');
    const r = this.confirmResolve;
    this.confirmResolve = null;
    r?.(v);
  }

  /** Mostra o modal de confirmação e resolve true/false conforme o botão clicado. */
  private confirmDialog(title: string, message: string, yesLabel: string, noLabel: string): Promise<boolean> {
    this.confirmTitleEl.textContent = title;
    this.confirmMsgEl.textContent = message;
    this.confirmYesBtn.textContent = yesLabel;
    this.confirmNoBtn.textContent = noLabel;
    this.confirmModal.classList.remove('ms-hidden');
    return new Promise((resolve) => { this.confirmResolve = resolve; });
  }

  // ================= Histórico: geração de títulos em lote + import/export de backup =================

  /** Sem título de verdade — padrão da plataforma OU título corrompido por uma recusa de IA
   *  numa rodada anterior (ex.: "A reunião não contém informações suficientes..."). */
  private needsTitle(m: HistoryMeta): boolean {
    return isGenericTitleText(m.title, m.meetingCode) || looksLikeBadAiTitle(m.title);
  }

  /** Mostra/esconde o banner "N reuniões sem título — sugerir com IA?" no topo da lista. */
  private renderHistTitleBanner() {
    const hi = t().history;
    if (this.histBulkTitleBusy) {
      this.histTitleBanner.classList.remove('ms-hidden');
      return;
    }
    const count = this.histMetas.filter((m) => this.needsTitle(m)).length;
    if (count === 0 || !this.ollamaReady(store.get())) {
      this.histTitleBanner.classList.add('ms-hidden');
      return;
    }
    this.histTitleBanner.classList.remove('ms-hidden');
    this.histTitleBanner.replaceChildren(
      el('span', { class: 'ms-hist-ai-text', text: hi.generateTitlesHint(count) }),
      (() => {
        const b = el('button', { class: 'ms-btn ms-btn-primary ms-hist-ai-btn', type: 'button', text: hi.generateTitles }) as HTMLButtonElement;
        b.addEventListener('click', () => void this.runBulkTitleGeneration());
        return b;
      })(),
    );
  }

  /** Gera (via IA) um título para cada reunião com título genérico e PERSISTE no histórico
   *  (diferente do download com IA, que só sugere para o arquivo baixado). */
  private async runBulkTitleGeneration() {
    if (this.histBulkTitleBusy) return;
    const s = store.get();
    if (!this.ollamaReady(s)) return;
    const targets = this.histMetas.filter((m) => this.needsTitle(m));
    if (!targets.length) return;

    this.histBulkTitleBusy = true;
    let done = 0;
    this.histTitleBanner.replaceChildren(el('span', { class: 'ms-hist-ai-text', text: t().history.generatingTitles(done, targets.length) }));

    for (const m of targets) {
      this.histProcessingId = m.id;
      this.histProcessingLabel = t().history.generatingTitleCard;
      this.renderHistoryList(); // mostra o spinner NESTE card antes de começar a chamada à IA
      try {
        const saved = await loadMeeting(m.id);
        if (saved && saved.session.transcript.length > 0) {
          const title = await suggestMeetingTitle(saved.session, s.settings.ollamaUrl, s.settings.ollamaModel!, s.settings.vocabulary);
          if (title) {
            await renameMeeting(m.id, title);
            m.title = title;
          }
        }
      } catch {
        /* segue pro próximo */
      }
      done++;
      this.histTitleBanner.replaceChildren(el('span', { class: 'ms-hist-ai-text', text: t().history.generatingTitles(done, targets.length) }));
      this.renderHistoryList();
    }

    this.histProcessingId = null;
    this.histBulkTitleBusy = false;
    this.histMetas = await loadHistory();
    this.renderHistoryList();
  }

  private showHistImportStatus(text: string, isError: boolean) {
    this.histImportStatus.textContent = text;
    this.histImportStatus.classList.remove('ms-hidden');
    this.histImportStatus.classList.toggle('is-error', isError);
    window.setTimeout(() => this.histImportStatus.classList.add('ms-hidden'), 4000);
  }

  private async handleImportFile() {
    const file = this.histImportInput.files?.[0];
    this.histImportInput.value = ''; // permite selecionar o mesmo arquivo de novo depois
    if (!file) return;
    const hi = t().history;
    try {
      const text = await file.text();
      const result = await importMeetingBackup(text);
      if (result.ok) {
        this.showHistImportStatus(hi.importOk, false);
        this.histMetas = await loadHistory();
        this.renderHistoryList();
      } else {
        this.showHistImportStatus(hi.importError, true);
      }
    } catch {
      this.showHistImportStatus(hi.importError, true);
    }
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

    // Sheet "Sobre" (abre por mensagem do popup — o botão do header já abre direto, sem passar
    // pelo store; aqui só cobre o gatilho externo).
    if (!!s.ui.aboutOpen !== this.lastAboutOpen) {
      this.lastAboutOpen = !!s.ui.aboutOpen;
      if (s.ui.aboutOpen) this.aboutSheet.classList.remove('ms-hidden');
    }

    this.ccBtn.classList.toggle('is-active', s.captionsOn);
    this.captionsToggle.setOn(s.captionsOn);
    this.captionsToggle.setDisabled(s.ended);

    // Indicador compacto + status strip (REC/clay) — só atualiza quando o estado muda.
    if (this.lastDotKind !== s.captureStatus) {
      this.lastDotKind = s.captureStatus;
      const cs = t().captureStatus;
      const map: Record<string, { dot: string; label: string; lcls: string }> = {
        capturing: { dot: 'is-rec', label: cs.active, lcls: 'is-rec' },
        processing: { dot: 'is-processing', label: cs.processing, lcls: '' },
        error: { dot: 'is-error', label: cs.errorShort, lcls: 'is-error' },
      };
      const m = map[s.captureStatus] ?? { dot: 'is-paused', label: cs.paused, lcls: 'is-paused' };
      this.compactDot.className = `ms-dot ${m.dot}`;
      this.compactDotLabel.textContent = m.label;
      this.compactDotLabel.className = m.lcls;
    }
    const cs = t().captureStatus;
    if (s.ended) statusInto(this.stripStatus, 'idle', cs.endedStrip);
    else if (s.captureStatus === 'capturing') statusInto(this.stripStatus, 'rec', cs.active);
    else if (s.captureStatus === 'processing') statusInto(this.stripStatus, 'busy', cs.processingEllipsis);
    else if (s.captureStatus === 'error') statusInto(this.stripStatus, 'error', cs.errorProcessing);
    else statusInto(this.stripStatus, 'paused', cs.capturePaused);

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
    const xn = t().exportTab;
    this.tgCorrect.setOn(s.settings.enableAiCorrection); this.tgCorrect.setDisabled(!ready); this.tgCorrect.setNote(ready ? null : xn.noteRequiresOllamaModel);
    this.tgSummary.setOn(s.settings.includeSummary); this.tgSummary.setDisabled(!ready); this.tgSummary.setNote(ready ? null : xn.noteRequiresOllamaModel);
    this.tgSeparate.setOn(s.settings.separateSummaryFile); this.tgSeparate.setDisabled(!ready || !s.settings.includeSummary); this.tgSeparate.setNote(!ready ? xn.noteRequiresOllama : (!s.settings.includeSummary ? xn.noteEnableSummaryFirst : null));
    this.tgJson.setOn(s.settings.exportJson);
    if (!isFocused(this.selfNameInput) && this.selfNameInput.value !== s.settings.selfName) this.selfNameInput.value = s.settings.selfName;
    this.renderVocab(s);

    // Alertas de menção — barra de arme, som, regras, recentes
    const armed = s.settings.alertsArmed;
    this.tgArmed.setOn(armed);
    this.armCard.classList.toggle('is-armed', armed);
    this.armIcon.innerHTML = icons.ear;
    this.armSub.textContent = armed ? t().alerts.listening : t().alerts.pausedSub;
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
    if (!isFocused(this.ollamaUrlInput) && this.ollamaUrlInput.value !== s.settings.ollamaUrl) this.ollamaUrlInput.value = s.settings.ollamaUrl;
    this.renderOllamaStatus(s);
    this.renderModelPills(s);

    this.renderChat(s);
    this.refreshPreview();
    this.renderFooter(s);
    this.syncRealtimeTimer(s);
  }

  private renderFooter(s: AppState) {
    const aiActive = this.ollamaReady(s) && (s.settings.enableAiCorrection || s.settings.includeSummary);
    this.downloadBtn.textContent = this.busy ? t().footer.processingOllama : (aiActive ? t().footer.downloadAi : t().footer.downloadTxt);
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
    const rt = t().rtStatus;
    if (s.ui.summarizing) {
      icon = 'spinner'; cls = 'ms-sum-status is-generating'; text = rt.generating;
    } else if (!active) {
      icon = 'none'; cls = 'ms-sum-status ms-hidden';
    } else {
      const n = s.session.transcript.length;
      const pending = this.transcriptSig(s) !== this.lastRtSig;
      const secs = Math.max(0, Math.ceil((this.nextRtAt - Date.now()) / 1000));
      const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      if (n === 0) text = rt.waitingFirst;
      else if (secs > 0) text = rt.live(mmss, pending);
      else text = rt.updating;
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
    const sc = t().summaryContent;
    let msg: string;
    if (!this.ollamaReady(s)) msg = sc.configureOllama;
    else if (!s.settings.realtimeSummary) msg = sc.enableRt;
    else if (s.session.transcript.length === 0) msg = sc.rtActiveWaiting;
    else msg = sc.rtActiveSoon;
    const ph = `__ph__${msg}`;
    if (this.renderedSummary !== ph) { this.renderedSummary = ph; this.summaryContent.replaceChildren(el('div', { class: 'ms-sum-p', text: msg })); }
  }

  private renderSkeleton() {
    const widths = ['45%', '92%', '80%', '60%', '88%', '70%'];
    this.summaryContent.replaceChildren(...widths.map((w) => { const l = el('div', { class: 'ms-skel-line ms-shimmer' }); l.style.width = w; return l; }));
  }

  // ---------- Ollama UI ----------
  private renderOllamaStatus(s: AppState) {
    const os = t().ollamaStatus;
    if (s.ollama.testing) statusInto(this.ollamaStatusEl, 'busy', os.connecting);
    else if (s.ollama.lastError) statusInto(this.ollamaStatusEl, 'error', os.error(s.ollama.lastError));
    else if (s.ollama.reachable && s.ollama.models.length) statusInto(this.ollamaStatusEl, 'active', os.connected(s.ollama.models.length));
    else statusInto(this.ollamaStatusEl, 'idle', os.notConnected);
  }

  private renderModelPills(s: AppState) {
    const models = s.ollama.models;
    const sig = models.join(',') + '|' + (s.settings.ollamaModel ?? '');
    if (this.modelPills.dataset.sig === sig) return;
    this.modelPills.dataset.sig = sig;
    if (!models.length) {
      this.modelPills.replaceChildren(el('span', { class: 'ms-muted-sm', text: t().exportTab.testToList }));
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
        this.chatList.replaceChildren(el('div', { class: 'ms-chat-empty', text: t().transcript.empty }));
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
        if (isChat) head.append(el('span', { class: 'ms-msg-tag' }, [el('span', { class: 'ms-tag-ico', html: icons.chatBubble }), el('span', { text: t().exportFile.chatTag })]));
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
    const tl = t().tail;
    if (s.ended) statusInto(this.tailStatus, 'idle', tl.ended);
    else if (s.captureStatus === 'capturing') statusInto(this.tailStatus, 'rec', tl.capturing);
    else statusInto(this.tailStatus, 'paused', tl.paused);
  }

  private refreshPreview() {
    const s = store.get();
    let txt: string;
    if (this.previewMode === 'ata') {
      txt = s.ui.summaryText ? buildSummaryTxt(s.session, s.ui.summaryText) : t().exportTab.previewAtaEmpty;
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
      if ((settings.enableAiCorrection || settings.includeSummary) && ready) store.setCaptureStatus('processing');

      await this.aiExport(session, {
        correct: settings.enableAiCorrection && ready,
        summary: settings.includeSummary && ready,
      });

      if (store.get().captureStatus === 'processing') store.setCaptureStatus(store.get().captionsOn ? 'capturing' : 'waiting');
    } finally {
      this.busy = false; this.renderFooter(store.get());
      window.removeEventListener('beforeunload', this.unloadGuard);
    }
  }

  /** Corrige/resume a sessão via IA (conforme `opts`) e dispara os downloads (.txt + ata/json
   *  segundo as opções de exportação). Usado no fim da reunião e no histórico.
   *  `existingSummary`: ata já salva (histórico) — reutiliza em vez de gerar de novo. */
  private async aiExport(
    session: MeetingSession,
    opts: { correct: boolean; summary: boolean; existingSummary?: string },
  ) {
    const settings = store.get().settings;
    let corrected = false;
    let correctedText = '';
    let summaryText: string | undefined = opts.existingSummary;

    if (opts.correct) {
      try { correctedText = await correctTranscript(session, settings.ollamaUrl, settings.ollamaModel!, settings.vocabulary); corrected = true; }
      catch (err) { store.setCaptureStatus('error'); store.patchOllama({ lastError: t().ollamaStatus.correctionFailed(err instanceof Error ? err.message : String(err)) }); }
    }
    let summaryGeneratedNow = false;
    if (!summaryText && opts.summary) {
      try {
        summaryText = await summarizeMeeting(session, settings.ollamaUrl, settings.ollamaModel!, settings.vocabulary);
        summaryGeneratedNow = true;
        store.patchUi({ summaryText });
      } catch (err) { store.setCaptureStatus('error'); store.patchOllama({ lastError: t().ollamaStatus.summaryFailed(err instanceof Error ? err.message : String(err)) }); }
    }
    // Persiste a ata gerada agora de volta no registro da reunião — sem isso o histórico
    // continuava marcando "Sem ata" mesmo depois de já ter baixado o arquivo com a ata.
    if (summaryGeneratedNow && summaryText) {
      try { await updateMeetingSummary(session.id, summaryText); } catch { /* ignora — o arquivo já foi baixado normalmente */ }
    }

    // Sem título descritivo (é o padrão da plataforma)? Sugere um via IA — só para o arquivo
    // exportado; nunca sobrescreve o título salvo no histórico.
    let exportSession = session;
    if (isGenericTitle(session)) {
      try {
        const suggested = await suggestMeetingTitle(session, settings.ollamaUrl, settings.ollamaModel!, settings.vocabulary);
        if (suggested) exportSession = { ...session, meetingTitle: suggested };
      } catch {
        /* mantém o título original */
      }
    }

    const includeSummaryInline = !!summaryText && !settings.separateSummaryFile;
    const mainContent = corrected
      ? (settings.includeHeaderByDefault ? buildHeader(exportSession) : '') + correctedText + (includeSummaryInline ? summarySectionBlock(summaryText!) : '')
      : buildTxt(exportSession, { includeHeader: settings.includeHeaderByDefault, summaryText: includeSummaryInline ? summaryText : undefined });

    // Espaça os downloads — o Chrome descarta downloads automáticos disparados juntos.
    const gap = () => new Promise<void>((r) => setTimeout(r, 500));
    downloadText(buildFilename(session), mainContent);
    if (summaryText && settings.separateSummaryFile) { await gap(); downloadText(buildFilename(session, t().exportFile.filenameSummarySuffix), buildSummaryTxt(exportSession, summaryText)); }
    if (settings.exportJson) { await gap(); downloadText(buildFilename(session, '', 'json'), buildMeetingJson(exportSession, summaryText)); }

    return { summaryGeneratedNow };
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
