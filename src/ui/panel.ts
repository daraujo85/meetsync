// UI do MeetSync: barra compacta (§10.1) + painel expandido (§10.2). Vanilla TS, dentro do
// Shadow DOM. Assina o `store` e atualiza o DOM. Estrutura segue o mockup (HANDOFF §3):
// header · status strip · tabs (Transcrição/Resumo/Exportar/Upload) · conteúdo · footer.

import { el } from './dom';
import { icons } from './icons';
import { logoImg } from './logo';
import { store, type AppState } from '@/services/store';
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
};

type TabId = 'transcript' | 'summary' | 'export' | 'upload';
const TABS: Array<{ id: TabId; label: string; beta?: boolean }> = [
  { id: 'transcript', label: 'Transcrição' },
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

  // export
  private tgAutoStart!: ReturnType<typeof toggleRow>;
  private tgAutoChat!: ReturnType<typeof toggleRow>;
  private tgHeader!: ReturnType<typeof toggleRow>;
  private tgCorrect!: ReturnType<typeof toggleRow>;
  private tgSummary!: ReturnType<typeof toggleRow>;
  private tgSeparate!: ReturnType<typeof toggleRow>;
  private tgJson!: ReturnType<typeof toggleRow>;
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
    container.append(this.buildCompact(), this.buildPanel());
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

    this.compactDot = el('span', { class: 'ms-dot' });
    this.compactDotLabel = el('span', { text: 'Pausado' });
    const dot = el('div', { class: 'ms-capture-dot' }, [this.compactDot, this.compactDotLabel]);

    this.compact = el('div', { class: 'ms-compact' }, [logo, expandBtn, this.ccBtn, dlBtn, el('div', { class: 'ms-divider' }), dot]);
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
      this.buildExportTab(),
      this.buildUploadTab(),
    ]);

    this.aboutSheet = this.buildAbout();
    this.panel = el('div', { class: 'ms-panel ms-hidden' }, [header, strip, tabs, body, this.buildFooter(), this.aboutSheet]);
    return this.panel;
  }

  private buildHeader(): HTMLElement {
    const aboutBtn = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', title: 'Sobre o MeetSync', 'aria-label': 'Sobre', html: icons.info });
    aboutBtn.addEventListener('click', () => this.aboutSheet.classList.remove('ms-hidden'));
    const closeBtn = el('button', { class: 'ms-icon-btn ms-icon-btn-sm', title: 'Recolher painel', 'aria-label': 'Recolher', html: icons.collapse });
    closeBtn.addEventListener('click', () => store.patchUi({ expanded: false }));

    const header = el('div', { class: 'ms-header' }, [
      el('span', { class: 'ms-header-logo' }, [logoImg(26)]),
      el('span', { class: 'ms-wordmark' }, [el('span', { class: 'ms-wm-meet', text: 'Meet' }), el('span', { class: 'ms-wm-sync', text: 'Sync' })]),
      el('span', { class: 'ms-badge', text: 'Beta' }),
      el('div', { class: 'ms-spacer' }),
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

    const scroll = el('div', { class: 'ms-tabpanel ms-scroll' }, [
      el('div', { class: 'ms-section' }, [this.sectionLabel('Preferências de captura', icons.clock), this.tgAutoStart.root, this.tgAutoChat.root]),
      el('div', { class: 'ms-section' }, [this.sectionLabel('Opções de exportação', icons.settings), this.tgHeader.root, this.tgCorrect.root, this.tgSummary.root, this.tgSeparate.root, this.tgJson.root]),
      ollamaSection,
      previewSection,
    ]);
    this.tabPanels.set('export', scroll);
    return scroll;
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

  // ================= Atualização reativa =================
  private update(s: AppState) {
    const visible = s.inMeeting || s.ended; // pós-reunião: painel continua para revisar/baixar
    this.compact.classList.toggle('ms-hidden', s.ui.expanded || !visible);
    this.panel.classList.toggle('ms-hidden', !s.ui.expanded || !visible);

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
    try {
      let corrected = false;
      let correctedText = '';
      let summaryText: string | undefined;

      if ((settings.enableAiCorrection || settings.includeSummary) && ready) store.setCaptureStatus('processing');

      if (settings.enableAiCorrection && ready) {
        try { correctedText = await correctTranscript(session, settings.ollamaUrl, settings.ollamaModel!); corrected = true; }
        catch (err) { store.setCaptureStatus('error'); store.patchOllama({ lastError: `Correção falhou: ${err instanceof Error ? err.message : String(err)}` }); }
      }
      if (settings.includeSummary && ready) {
        try { summaryText = await summarizeMeeting(session, settings.ollamaUrl, settings.ollamaModel!); store.patchUi({ summaryText }); }
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
      const text = await summarizeMeetingStream(s.session, s.settings.ollamaUrl, s.settings.ollamaModel!, (acc) => store.patchUi({ summaryText: acc }));
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
