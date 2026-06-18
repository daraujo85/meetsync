// Dicionário PT-BR — fonte de referência do i18n. O tipo `Messages` é inferido daqui;
// en.ts/es.ts são tipados como `Messages`, então qualquer chave faltante quebra o build (tsc strict).

export const pt = {
  // BCP-47 usado em toLocaleString/Intl para este idioma.
  _bcp47: 'pt-BR',

  langName: { pt: 'Português', en: 'Inglês', es: 'Espanhol' },

  compact: {
    logoTitle: 'MeetSync · arraste para mover',
    openPanel: 'Abrir painel MeetSync',
    openPanelAria: 'Abrir painel',
    captionsToggle: 'Ligar/desligar legendas',
    captionsAria: 'Legendas',
    downloadTxt: 'Baixar transcrição (.txt)',
    downloadAria: 'Baixar',
    alertsBell: 'Alertas de menção',
    alertsAria: 'Alertas',
    paused: 'Pausado',
  },

  header: {
    history: 'Histórico de reuniões',
    about: 'Sobre o MeetSync',
    aboutAria: 'Sobre',
    collapse: 'Recolher painel',
    collapseAria: 'Recolher',
    beta: 'Beta',
    back: 'Voltar',
    ask: 'Perguntar à reunião',
  },
  ask: {
    title: 'Perguntar à reunião',
    subtitle: 'Respostas com base na transcrição capturada',
    placeholder: 'Ex.: o Lucas falou sobre quitação?',
    send: 'Enviar',
    emptyTitle: 'Pergunte qualquer coisa sobre esta reunião',
    emptyDesc: 'A IA responde com base no que foi capturado na transcrição.',
    ex1: 'Quais foram as decisões?',
    ex2: 'O que ficou pendente?',
    ex3: 'Alguém falou sobre prazos?',
    requiresOllama: 'Conecte o Ollama (aba Exportar) para perguntar.',
    noTranscript: 'Ainda não há transcrição capturada para perguntar.',
    error: 'Não consegui responder agora. Verifique o Ollama e tente de novo.',
    historyAction: 'Perguntar à reunião',
    historyActionSub: 'Pergunte à IA sobre esta reunião',
  },

  tabs: {
    transcript: 'Transcrição',
    alerts: 'Alertas',
    summary: 'Resumo',
    export: 'Exportar',
    upload: 'Upload',
    beta: 'beta',
  },

  statusStrip: { captions: 'Legendas' },

  transcript: {
    empty: 'Nenhuma fala capturada ainda. Ative as legendas do Meet para começar.',
    jumpToEnd: 'Ir para o fim',
  },

  summaryTab: {
    rtTitle: 'Resumo em tempo real',
    rtHelp: 'Atualiza a ata automaticamente, via streaming do Ollama.',
    updateEvery: 'Atualizar a cada',
    min: 'min',
  },

  captureStatus: {
    active: 'Captura ativa',
    processing: 'Processando',
    errorShort: 'Erro IA',
    paused: 'Pausado',
    endedStrip: 'Reunião encerrada — revise e baixe abaixo',
    processingEllipsis: 'Processando…',
    errorProcessing: 'Erro ao processar IA',
    capturePaused: 'Captura pausada',
  },

  tail: {
    ended: 'Reunião encerrada — esta transcrição fica aqui até você sair da aba.',
    capturing: 'Capturando legendas em tempo real…',
    paused: 'Captura pausada — ligue as legendas para continuar',
  },

  alerts: {
    monitorTitle: 'Monitorar a reunião',
    listening: 'Ouvindo · você será avisado mesmo distraído',
    pausedSub: 'Pausado · nenhum alerta será disparado',
    playSound: 'Tocar som ao alertar',
    watchedExpr: 'Expressões monitoradas',
    addExpr: 'Adicionar expressão',
    keyword: 'Palavra / frase',
    aiContext: 'IA por contexto',
    newExprAria: 'Nova expressão',
    add: 'Adicionar',
    keywordLabel: 'Palavra ou frase',
    aiLabel: 'Contexto monitorado',
    recentDetections: 'Detecções recentes',
    noExpr: 'Nenhuma expressão. Adicione abaixo.',
    badgeAi: 'IA',
    badgePhrase: 'frase',
    noTermsYet: 'Sem termos ainda — adicione abaixo.',
    requiresOllama: 'Requer Ollama configurado na aba Exportar.',
    simulate: 'Simular detecção',
    remove: 'Remover',
    placeholderKeyword: 'ex.: meu nome, orçamento, prazo…',
    placeholderAi: 'ex.: quando pedirem uma decisão minha',
    helpKeyword: 'Dispara quando alguém (que não seja você) falar a palavra ou frase. Separe variações por vírgula.',
    helpAi: 'A IA observa o contexto em tempo real e dispara quando o sentido bater — não precisa ser a frase exata.',
    demoWho: 'Participante',
    demoTimeNow: 'agora',
    demoReasonKeyword: (term: string) => `Mencionaram "${term}"`,
    demoReasonAi: (label: string) => `IA · ${label}`,
    demoTextKeyword: (term: string) => `…acho que precisamos olhar "${term}" com calma antes de decidir.`,
    demoTextAi: '…isso depende de você, consegue confirmar até amanhã pra gente seguir?',
  },

  overlay: {
    dismissAria: 'Dispensar',
    goToMeeting: 'Ir para a reunião',
    dismiss: 'Dispensar',
    detectionAi: 'Detecção por IA',
    meetingAlert: 'Alerta da reunião',
  },

  exportTab: {
    capturePrefs: 'Preferências de captura',
    autoStart: 'Iniciar captura automaticamente',
    autoStartDesc: 'Ao entrar na reunião, liga as legendas e começa a capturar.',
    autoChat: 'Capturar chat de texto',
    autoChatDesc: 'Abre o chat do Meet automaticamente quando chega mensagem nova.',
    header: 'Incluir cabeçalho',
    headerDesc: 'Reunião, link, código, data, horários e participantes.',
    correct: 'Corrigir com IA',
    correctDesc: 'Ajusta pontuação e erros de reconhecimento, sem inventar conteúdo.',
    summary: 'Incluir resumo / ata',
    summaryDesc: 'Adiciona um resumo estruturado ao final do arquivo.',
    separate: 'Gerar arquivo separado de resumo',
    separateDesc: 'Baixa a ata como um segundo arquivo .txt.',
    json: 'Dados estruturados (.json)',
    jsonDesc: 'Também baixa um JSON pronto para agentes de IA e automações.',
    exportOptions: 'Opções de exportação',
    language: 'Idioma',
    languageDesc: 'Idioma da interface, das exportações e das respostas da IA.',
    yourName: 'Seu nome',
    yourNamePlaceholder: 'ex.: Diego Araujo',
    yourNameDesc: 'Aparece no lugar de “Você” na transcrição, nas exportações e nos resumos.',
    vocabTitle: 'Vocabulário do negócio',
    vocabDescHtml:
      'Nomes de empresas, produtos e siglas do seu dia a dia. A IA usa esta lista para corrigir palavras que a transcrição do Google escreveu errado — ex.: <span class="ms-vocab-ex">"acme corp" → "Acme"</span>.',
    vocabPlaceholder: 'ex.: Acme, Globex, OKRs…',
    vocabAdd: 'Adicionar',
    vocabEmpty: 'Nenhum termo ainda. Adicione abaixo.',
    vocabNewAria: 'Novo termo',
    vocabAppliedActive: (n: number) =>
      `Será aplicado na correção da transcrição e no resumo (${n} ${n === 1 ? 'termo' : 'termos'}).`,
    vocabAppliedInactive: 'Aplicado automaticamente quando “Corrigir com IA” ou o resumo estiverem ativos.',
    ollamaTitle: 'Integração Ollama',
    serverUrl: 'URL do servidor',
    ollamaUrlAria: 'URL do Ollama',
    test: 'Testar',
    model: 'Modelo',
    ollamaPrivacy: 'O conteúdo só é enviado para a URL do Ollama quando a IA estiver ativa. Nada vai para serviços externos.',
    testToList: 'Teste a conexão para listar os modelos.',
    preview: 'Prévia do arquivo',
    previewTranscript: 'Transcrição',
    previewSummary: 'Resumo',
    previewAtaEmpty: 'Gere o resumo/ata (aba Resumo ou no download) para ver a prévia aqui.',
    noteRequiresOllamaModel: 'Requer Ollama configurado e modelo selecionado.',
    noteRequiresOllama: 'Requer Ollama configurado.',
    noteEnableSummaryFirst: 'Ative “Incluir resumo / ata” primeiro.',
  },

  ollamaStatus: {
    connecting: 'Conectando ao servidor…',
    error: (msg: string) => `Erro: ${msg}`,
    connected: (n: number) => `Conectado — ${n} modelos`,
    notConnected: 'Não conectado',
    correctionFailed: (msg: string) => `Correção falhou: ${msg}`,
    summaryFailed: (msg: string) => `Resumo falhou: ${msg}`,
  },

  // Regras-semente de alerta (rótulos exibidos por id; o dado salvo pode estar em qualquer idioma).
  seedWatch: {
    nameLabel: 'Menção ao seu nome',
    sharedLabel: 'Falaram do que você compartilhou',
    sharedDesc: 'Detecta quando citam a tela, planilha ou documento que você apresentou.',
    decisionLabel: 'Pediram uma decisão ou ação sua',
    decisionDesc: 'Avisa quando o contexto indica que esperam uma resposta ou aprovação sua.',
  },

  summaryContent: {
    configureOllama: 'Configure um servidor Ollama na aba Exportar e escolha um modelo para gerar a ata.',
    enableRt: 'Ative “Resumo em tempo real” acima, ou gere a ata ao baixar.',
    rtActiveWaiting: 'Resumo em tempo real ativo ✓ Aguardando as primeiras falas…',
    rtActiveSoon: 'Resumo em tempo real ativo ✓ A ata será gerada em instantes.',
  },

  rtStatus: {
    generating: 'Gerando resumo · aguardando o Ollama…',
    waitingFirst: 'Aguardando as primeiras falas…',
    updating: 'Atualizando…',
    live: (mmss: string, pending: boolean) => `Ao vivo · próxima em ${mmss}${pending ? ' · novas falas' : ''}`,
  },

  footer: {
    processingOllama: 'Processando com Ollama…',
    downloadAi: 'Baixar .txt com IA',
    downloadTxt: 'Baixar transcrição (.txt)',
    downloadTxtShort: 'Baixar .txt',
    downloadWithoutAi: 'Baixar sem IA',
  },

  upload: {
    providerS3: 'Amazon S3',
    providerMinio: 'MinIO',
    sendNow: 'Enviar agora',
    purpose:
      'Envie a transcrição para um bucket S3/MinIO — destino comum para agentes de IA e rotinas automatizadas consumirem as reuniões.',
    bucketDest: 'Destino do bucket',
    endpoint: 'Endpoint',
    region: 'Região',
    bucket: 'Bucket',
    accessKey: 'Access Key ID',
    secretKey: 'Secret Access Key',
    prefix: 'Prefixo / pasta (opcional)',
    prefixPlaceholder: 'transcricoes/',
    whatToSend: 'O que enviar',
    sendTxt: 'Transcrição (.txt)',
    sendTxtDesc: 'Arquivo de texto com cabeçalho e falas.',
    sendAta: 'Resumo / ata (.txt)',
    sendAtaDesc: 'Ata gerada pela IA.',
    sendJson: 'Dados estruturados (.json)',
    sendJsonDesc: 'Payload pronto para agentes de IA e automações.',
    sendAuto: 'Enviar automaticamente ao encerrar',
    sendAutoDesc: 'Sobe os arquivos sozinho quando a reunião termina.',
    lockedTitle: 'Envio para bucket',
    lockedBadge: 'Beta',
    lockedDesc: 'O envio para bucket S3/MinIO chega em breve. Os campos abaixo são uma prévia e estão desabilitados.',
  },

  about: {
    title: 'Sobre',
    version: 'Versão MVP 0.1',
    desc: 'Captura e organiza as legendas das suas reuniões do Google Meet e exporta a transcrição em .txt — direto no navegador, com privacidade.',
    devBy: 'Desenvolvido pela DevSync',
    privacy: 'Os dados da reunião ficam no seu navegador. Nada é enviado para serviços externos sem a sua ação.',
  },

  history: {
    title: 'Histórico de reuniões',
    searchPlaceholder: 'Buscar por título ou participante',
    searchAria: 'Buscar',
    privacy: 'O histórico fica salvo apenas neste navegador. Exporte para guardar fora do dispositivo.',
    count: (n: number) => `${n} ${n === 1 ? 'reunião' : 'reuniões'}`,
    notFound: 'Nenhuma reunião encontrada.',
    empty: 'Nenhuma reunião no histórico ainda.',
    lines: (n: number) => `${n} ${n === 1 ? 'linha' : 'linhas'}`,
    withAta: 'Com ata',
    withoutAta: 'Sem ata',
    local: 'Local',
    favorite: 'Favoritar',
    duration: 'Duração',
    linesChat: 'Linhas / chat',
    chatSuffix: (n: number) => ` · ${n} chat`,
    people: (n: number) => `${n} pessoas`,
    participants: 'Participantes',
    actions: 'Ações',
    previewFoot: (n: number) => `Prévia · ${n} linhas no total`,
    noAtaGenerated: 'Esta reunião não tem ata gerada.',
    dlTxt: 'Baixar transcrição (.txt)',
    dlTxtSub: 'Transcrição original, sem correção de IA',
    dlAi: 'Baixar .txt com IA',
    dlAiSub: 'Corrige a transcrição (e gera a ata) com IA',
    dlAiSubNoOllama: 'Requer Ollama conectado',
    dlAiBusy: 'Processando com IA…',
    dlAiBusySub: 'Pode levar alguns segundos',
    dlAta: 'Baixar resumo / ata',
    dlAtaSubYes: 'Ata estruturada desta reunião',
    dlAtaSubNo: 'Esta reunião não tem ata gerada',
    del: 'Excluir do histórico',
    delSub: 'Apaga a transcrição deste dispositivo',
    meetingFallback: 'Reunião',
  },

  popup: {
    privacy: 'Privacidade',
    help: 'Ajuda',
    outsideMsg1Html: 'O MeetSync funciona <strong>dentro do Google Meet</strong>.',
    outsideMsg2: 'Entre numa reunião para capturar as legendas, ver o chat e exportar a transcrição.',
    idleMsg1Html: 'Você está no <strong>Google Meet</strong>.',
    idleMsg2: 'Entre numa reunião e a captura das legendas começa automaticamente.',
    goToMeet: 'Ir para o Google Meet',
    statusIdle: 'Parado',
    waitingCaptions: 'Aguardando legendas',
    captureActive: 'Captura ativa',
    processingAi: 'Processando (IA)',
    errorAi: 'Erro de IA',
    meetingEnded: 'Reunião encerrada',
    lastMeeting: 'Última reunião salva',
    recSub: (title: string, lines: number, when: string) => `${title} · ${lines} fala(s) · ${when}`,
    dlWithAi: 'Baixar com IA',
    dlTxt: 'Baixar .txt',
    dlWithAiTitle: 'Baixar .txt com IA (correção + resumo)',
    dlTxtTitle: 'Baixar transcrição (.txt)',
    dlWithoutAiTitle: 'Baixar .txt sem IA',
    openHistoryTitle: (n: number) => `Abrir histórico de reuniões (${n})`,
    processingOllama: 'Processando com Ollama…',
    collapsePanel: 'Recolher painel',
    openPanel: 'Abrir painel',
    meetingEndedSub: (n: number) => `Reunião encerrada · ${n} fala(s)`,
    inMeetingSub: (entries: number, participants: number) => `${entries} fala(s) · ${participants} participante(s)`,
  },

  welcome: {
    docTitle: 'Bem-vindo ao MeetSync',
    tagline: 'Transcrição das suas reuniões do Google Meet — direto no navegador.',
    howToUse: 'Como usar',
    step1Html: '<strong>Entre numa reunião</strong> no Google Meet. O MeetSync aparece num painel no canto da tela.',
    step2Html:
      'As <strong>legendas são ligadas automaticamente</strong> e a captura começa — você vê as falas em tempo real, como um chat.',
    step3Html:
      'Clique no <strong>ícone do MeetSync na barra do Chrome</strong> a qualquer momento para abrir ou recolher o painel.',
    step4Html:
      'Ao final, <strong>exporte em .txt ou .json</strong>. Opcionalmente, gere correção e resumo com um servidor <strong>Ollama</strong> local.',
    captureNote: 'A captura nunca toca no áudio: o MeetSync apenas lê as legendas que o próprio Meet exibe.',
    goToMeet: 'Ir para o Google Meet',
    privacy: '🔒 Os dados da reunião ficam no seu navegador. Nada é enviado para serviços externos sem a sua ação.',
    privacyPolicy: 'Política de privacidade',
    github: 'GitHub',
  },

  notify: {
    captureStartedTitle: 'MeetSync — captura iniciada',
    capturingCode: (code: string) => `Capturando as legendas de ${code}.`,
    capturingMeeting: 'Capturando as legendas da reunião.',
    meetingEndedTitle: 'MeetSync — reunião encerrada',
    transcriptReady: (n: number) =>
      `Transcrição pronta${n ? ` (${n} fala${n === 1 ? '' : 's'})` : ''}. Abra o painel para revisar e baixar.`,
  },

  // Rótulos que entram nos arquivos exportados (.txt) e nos prompts de IA.
  exportFile: {
    headerTitle: 'MEETSYNC — TRANSCRIÇÃO DA REUNIÃO',
    transcriptSection: 'TRANSCRIÇÃO',
    summarySection: 'RESUMO / ATA',
    summaryHeaderTitle: 'MEETSYNC — RESUMO / ATA DA REUNIÃO',
    meeting: 'Reunião',
    link: 'Link',
    code: 'Código',
    date: 'Data',
    captureStart: 'Início da captura',
    captureEnd: 'Fim da captura',
    captureDuration: 'Duração da captura',
    participantsIdentified: 'Participantes identificados',
    notIdentified: '(não identificados)',
    noCaptions: '(sem falas capturadas)',
    untitledMeeting: 'Reunião sem título',
    chatTag: 'chat',
    filenameMeeting: 'reuniao',
    filenameSummarySuffix: '_resumo',
  },

  // Prompts de IA (Ollama). A saída do modelo segue o idioma da UI.
  ai: {
    languageName: 'português do Brasil',
    correctionPrompt: (vocabulary: string, metadata: string, transcript: string) =>
      `Você receberá uma transcrição capturada automaticamente do Google Meet (legendas).
Corrija erros de reconhecimento de fala, pontuação e quebras de frase, preservando fielmente o sentido.

Regras:
- Não invente informações nem remova falas relevantes.
- NÃO altere o NOME DO PARTICIPANTE que aparece antes dos dois-pontos (o "Nome:" de cada linha). Corrija apenas o TEXTO falado.
- Preserve os horários [HH:MM] e o formato de cada linha: [HH:MM] Nome: texto.
- Mantenha o português do Brasil.

Corrija com atenção especial a NOMES DE PRODUTOS, MARCAS, FERRAMENTAS E TERMOS TÉCNICOS que a
transcrição automática costuma aportuguesar ou escrever errado — especialmente termos em inglês
ouvidos como palavras em português. Use a grafia oficial correta. Exemplos do tipo de erro a corrigir:
- "Cláudio Code" / "Cláudio Código" / "Cláudio" (no contexto de IA/código) → "Claude Code" / "Claude"
- "guité" / "guírrabe" → "Git" / "GitHub"
- "paitão" → "Python";  "javascripti" → "JavaScript";  "ó lama" / "olama" → "Ollama"
- "vsicode" / "VS code" → "VS Code";  "no js" → "Node.js";  "react" → "React"
Use o CONTEXTO da conversa (assuntos técnicos, dev, IA) para inferir o termo correto. Quando o termo
claramente se refere a um produto/tecnologia conhecido, prefira a grafia oficial dele.
${vocabulary}
Contexto da reunião (use para entender o tema e desambiguar termos):
${metadata}

IMPORTANTE — formato da resposta:
- Responda APENAS com a transcrição corrigida, nada além disso.
- NÃO inclua preâmbulo, saudação, comentários, conclusão nem lista de alterações.
- NÃO adicione títulos, observações, notas de rodapé ou marcações de markdown.
- A primeira linha da sua resposta já deve ser a primeira linha da transcrição.

Transcrição:
${transcript}`,
    summaryPrompt: (vocabulary: string, metadata: string, transcript: string) =>
      `Você receberá a transcrição de uma reunião.
Gere uma ata objetiva em português do Brasil.

Inclua:
1. Principais assuntos discutidos.
2. Decisões identificadas.
3. Responsáveis mencionados.
4. Próximos passos.
5. Pontos de atenção.

Regras:
- Não invente decisões.
- Não invente responsáveis.
- Quando algo não estiver claro, escreva "não identificado na transcrição".
- Seja direto, profissional e útil.

Dados da reunião:
${metadata}
${vocabulary}
Transcrição:
${transcript}`,
    askPrompt: (vocabulary: string, metadata: string, transcript: string, conversation: string, question: string) =>
      `Você é um assistente que responde perguntas sobre UMA reunião, baseando-se ESTRITAMENTE na transcrição abaixo (legendas capturadas automaticamente do Google Meet).

Regras:
- Responda em português do Brasil, de forma direta e objetiva.
- Baseie-se SOMENTE no que está na transcrição. NÃO invente nada.
- Se a resposta não estiver na transcrição, diga claramente que isso não foi falado / não consta na reunião.
- Quando ajudar, cite quem falou e/ou o horário [HH:MM].
- A transcrição é automática e pode ter erros de reconhecimento; interprete com bom senso.
${vocabulary}
Contexto da reunião:
${metadata}

Transcrição:
${transcript}
${conversation ? `\nConversa até aqui (P = pergunta, R = resposta):\n${conversation}\n` : ''}
Pergunta: ${question}
Resposta:`,
    vocabularyClause: (terms: string) =>
      `\nVOCABULÁRIO DO NEGÓCIO — nomes de empresas, produtos e siglas do usuário. A transcrição automática
do Google costuma escrever esses termos errado (ex.: "acme corp" → "AcmeCorp"). Quando uma palavra do
texto não fizer sentido e se parecer (fonética ou grafia) com um destes, corrija para a grafia EXATA
abaixo. Use também para entender o contexto. Termos: ${terms}.\n`,
    meta: {
      meeting: 'Reunião',
      link: 'Link',
      code: 'Código',
      date: 'Data',
      start: 'Início',
      end: 'Fim',
      inProgress: '(em andamento)',
      participants: 'Participantes',
      untitled: 'sem título',
    },
    alertPrompt: (interests: string, lines: string) =>
      [
        'Você monitora uma reunião para um participante que NÃO está prestando atenção agora.',
        'Avise-o apenas quando algo nas falas tocar em um dos interesses abaixo.',
        '',
        'Interesses monitorados (numerados):',
        interests,
        '',
        'Falas recentes de outras pessoas na reunião:',
        lines,
        '',
        'Responda SOMENTE com um JSON válido, sem texto antes ou depois, no formato:',
        '{"relevante": true|false, "regra": <número do interesse que casou ou null>, "motivo": "frase curta em português"}',
        'Use "relevante": true apenas se as falas realmente tocam em algum interesse.',
      ].join('\n'),
  },
};

export type Messages = typeof pt;
