import type { Messages } from './pt';

export const es: Messages = {
  _bcp47: 'es-ES',

  langName: { pt: 'Portugués', en: 'Inglés', es: 'Español' },

  compact: {
    logoTitle: 'MeetSync · arrastra para mover',
    openPanel: 'Abrir panel de MeetSync',
    openPanelAria: 'Abrir panel',
    captionsToggle: 'Activar/desactivar subtítulos',
    captionsAria: 'Subtítulos',
    downloadTxt: 'Descargar transcripción (.txt)',
    downloadAria: 'Descargar',
    alertsBell: 'Alertas de mención',
    alertsAria: 'Alertas',
    paused: 'En pausa',
  },

  header: {
    history: 'Historial de reuniones',
    about: 'Acerca de MeetSync',
    aboutAria: 'Acerca de',
    collapse: 'Contraer panel',
    collapseAria: 'Contraer',
    beta: 'Beta',
    back: 'Volver',
    ask: 'Preguntar a la reunión',
  },
  ask: {
    title: 'Preguntar a la reunión',
    subtitle: 'Respuestas según la transcripción capturada',
    placeholder: 'Ej.: ¿Lucas habló sobre la liquidación?',
    send: 'Enviar',
    emptyTitle: 'Pregunta lo que quieras sobre esta reunión',
    emptyDesc: 'La IA responde según lo capturado en la transcripción.',
    ex1: '¿Cuáles fueron las decisiones?',
    ex2: '¿Qué quedó pendiente?',
    ex3: '¿Alguien habló de plazos?',
    requiresOllama: 'Conecta Ollama (pestaña Exportar) para preguntar.',
    noTranscript: 'Aún no hay transcripción capturada para preguntar.',
    error: 'No pude responder ahora. Revisa Ollama e inténtalo de nuevo.',
    historyAction: 'Preguntar a la reunión',
    historyActionSub: 'Pregunta a la IA sobre esta reunión',
  },

  events: {
    raisedHand: 'levantó la mano ✋',
    reacted: (emoji: string) => `reaccionó ${emoji}`,
    someone: 'Alguien',
  },

  tabs: {
    transcript: 'Transcripción',
    alerts: 'Alertas',
    summary: 'Resumen',
    export: 'Exportar',
    upload: 'Subir',
    beta: 'beta',
  },

  statusStrip: { captions: 'Subtítulos' },

  transcript: {
    empty: 'Aún no se capturó ningún diálogo. Activa los subtítulos de Meet para empezar.',
    jumpToEnd: 'Ir al final',
  },

  summaryTab: {
    rtTitle: 'Resumen en tiempo real',
    rtHelp: 'Actualiza el acta automáticamente, mediante streaming de Ollama.',
    updateEvery: 'Actualizar cada',
    min: 'min',
    copyWhatsapp: 'Copiar para WhatsApp',
    copyWhatsappBusy: 'Formateando…',
    copyWhatsappDone: '¡Copiado!',
  },

  captureStatus: {
    active: 'Capturando',
    processing: 'Procesando',
    errorShort: 'Error IA',
    paused: 'En pausa',
    endedStrip: 'Reunión finalizada — revisa y descarga abajo',
    processingEllipsis: 'Procesando…',
    errorProcessing: 'Error al procesar la IA',
    capturePaused: 'Captura en pausa',
  },

  tail: {
    ended: 'Reunión finalizada — esta transcripción queda aquí hasta que salgas de la pestaña.',
    capturing: 'Capturando subtítulos en tiempo real…',
    paused: 'Captura en pausa — activa los subtítulos para continuar',
  },

  alerts: {
    monitorTitle: 'Monitorear la reunión',
    listening: 'Escuchando · te avisaremos aunque estés distraído',
    pausedSub: 'En pausa · no se disparará ninguna alerta',
    playSound: 'Reproducir sonido al alertar',
    watchedExpr: 'Expresiones monitoreadas',
    addExpr: 'Agregar expresión',
    keyword: 'Palabra / frase',
    aiContext: 'IA por contexto',
    newExprAria: 'Nueva expresión',
    add: 'Agregar',
    keywordLabel: 'Palabra o frase',
    aiLabel: 'Contexto monitoreado',
    recentDetections: 'Detecciones recientes',
    noExpr: 'Ninguna expresión. Agrega una abajo.',
    badgeAi: 'IA',
    badgePhrase: 'frase',
    noTermsYet: 'Aún no hay términos — agrega algunos abajo.',
    requiresOllama: 'Requiere Ollama configurado en la pestaña Exportar.',
    simulate: 'Simular detección',
    remove: 'Quitar',
    placeholderKeyword: 'ej.: mi nombre, presupuesto, plazo…',
    placeholderAi: 'ej.: cuando pidan una decisión mía',
    helpKeyword: 'Se dispara cuando alguien (que no seas tú) diga la palabra o frase. Separa las variaciones con comas.',
    helpAi: 'La IA observa el contexto en tiempo real y se dispara cuando el sentido coincide — no hace falta la frase exacta.',
    demoWho: 'Participante',
    demoTimeNow: 'ahora',
    demoReasonKeyword: (term: string) => `Mencionaron "${term}"`,
    demoReasonAi: (label: string) => `IA · ${label}`,
    demoTextKeyword: (term: string) => `…creo que tenemos que mirar "${term}" con calma antes de decidir.`,
    demoTextAi: '…eso depende de ti, ¿puedes confirmar para mañana así seguimos?',
  },

  overlay: {
    dismissAria: 'Descartar',
    goToMeeting: 'Ir a la reunión',
    dismiss: 'Descartar',
    detectionAi: 'Detección por IA',
    meetingAlert: 'Alerta de la reunión',
  },

  exportTab: {
    capturePrefs: 'Preferencias de captura',
    autoStart: 'Iniciar la captura automáticamente',
    autoStartDesc: 'Al entrar en la reunión, activa los subtítulos y empieza a capturar.',
    autoChat: 'Capturar el chat de texto',
    autoChatDesc: 'Abre el chat de Meet automáticamente cuando llega un mensaje nuevo.',
    header: 'Incluir encabezado',
    headerDesc: 'Reunión, enlace, código, fecha, horarios y participantes.',
    correct: 'Corregir con IA',
    correctDesc: 'Ajusta la puntuación y los errores de reconocimiento, sin inventar contenido.',
    summary: 'Incluir resumen / acta',
    summaryDesc: 'Agrega un resumen estructurado al final del archivo.',
    separate: 'Generar archivo de resumen aparte',
    separateDesc: 'Descarga el acta como un segundo archivo .txt.',
    json: 'Datos estructurados (.json)',
    jsonDesc: 'También descarga un JSON listo para agentes de IA y automatizaciones.',
    exportOptions: 'Opciones de exportación',
    language: 'Idioma',
    languageDesc: 'Idioma de la interfaz, las exportaciones y las respuestas de la IA.',
    yourName: 'Tu nombre',
    yourNamePlaceholder: 'ej.: Diego Araujo',
    yourNameDesc: 'Aparece en lugar de “Tú” en la transcripción, las exportaciones y los resúmenes.',
    vocabTitle: 'Vocabulario del negocio',
    vocabDescHtml:
      'Nombres de empresas, productos y siglas de tu día a día. La IA usa esta lista para corregir palabras que la transcripción de Google escribió mal — ej.: <span class="ms-vocab-ex">"acme corp" → "Acme"</span>.',
    vocabPlaceholder: 'ej.: Acme, Globex, OKRs…',
    vocabAdd: 'Agregar',
    vocabEmpty: 'Aún no hay términos. Agrega algunos abajo.',
    vocabNewAria: 'Nuevo término',
    vocabAppliedActive: (n: number) =>
      `Se aplicará en la corrección de la transcripción y en el resumen (${n} ${n === 1 ? 'término' : 'términos'}).`,
    vocabAppliedInactive: 'Se aplica automáticamente cuando “Corregir con IA” o el resumen están activos.',
    ollamaTitle: 'Integración con Ollama',
    serverUrl: 'URL del servidor',
    ollamaUrlAria: 'URL de Ollama',
    test: 'Probar',
    model: 'Modelo',
    ollamaPrivacy: 'El contenido solo se envía a la URL de Ollama cuando la IA está activa. Nada va a servicios externos.',
    testToList: 'Prueba la conexión para listar los modelos.',
    preview: 'Vista previa del archivo',
    previewTranscript: 'Transcripción',
    previewSummary: 'Resumen',
    previewAtaEmpty: 'Genera el resumen/acta (pestaña Resumen o al descargar) para ver la vista previa aquí.',
    noteRequiresOllamaModel: 'Requiere Ollama configurado y un modelo seleccionado.',
    noteRequiresOllama: 'Requiere Ollama configurado.',
    noteEnableSummaryFirst: 'Activa “Incluir resumen / acta” primero.',
  },

  ollamaStatus: {
    connecting: 'Conectando al servidor…',
    error: (msg: string) => `Error: ${msg}`,
    connected: (n: number) => `Conectado — ${n} modelos`,
    notConnected: 'Sin conexión',
    correctionFailed: (msg: string) => `La corrección falló: ${msg}`,
    summaryFailed: (msg: string) => `El resumen falló: ${msg}`,
  },

  seedWatch: {
    nameLabel: 'Mención a tu nombre',
    sharedLabel: 'Hablaron de lo que compartiste',
    sharedDesc: 'Detecta cuando mencionan la pantalla, planilla o documento que presentaste.',
    decisionLabel: 'Pidieron una decisión o acción tuya',
    decisionDesc: 'Avisa cuando el contexto indica que esperan una respuesta o aprobación tuya.',
  },

  summaryContent: {
    configureOllama: 'Configura un servidor Ollama en la pestaña Exportar y elige un modelo para generar el acta.',
    enableRt: 'Activa “Resumen en tiempo real” arriba, o genera el acta al descargar.',
    rtActiveWaiting: 'Resumen en tiempo real activo ✓ Esperando los primeros diálogos…',
    rtActiveSoon: 'Resumen en tiempo real activo ✓ El acta se generará en instantes.',
  },

  rtStatus: {
    generating: 'Generando resumen · esperando a Ollama…',
    waitingFirst: 'Esperando los primeros diálogos…',
    updating: 'Actualizando…',
    live: (mmss: string, pending: boolean) => `En vivo · próxima en ${mmss}${pending ? ' · nuevos diálogos' : ''}`,
  },

  footer: {
    processingOllama: 'Procesando con Ollama…',
    downloadAi: 'Descargar .txt con IA',
    downloadTxt: 'Descargar transcripción (.txt)',
    downloadTxtShort: 'Descargar .txt',
    downloadWithoutAi: 'Descargar sin IA',
  },

  upload: {
    providerS3: 'Amazon S3',
    providerMinio: 'MinIO',
    sendNow: 'Enviar ahora',
    purpose:
      'Envía la transcripción a un bucket S3/MinIO — destino común para que agentes de IA y rutinas automatizadas consuman las reuniones.',
    bucketDest: 'Destino del bucket',
    endpoint: 'Endpoint',
    region: 'Región',
    bucket: 'Bucket',
    accessKey: 'Access Key ID',
    secretKey: 'Secret Access Key',
    prefix: 'Prefijo / carpeta (opcional)',
    prefixPlaceholder: 'transcripciones/',
    whatToSend: 'Qué enviar',
    sendTxt: 'Transcripción (.txt)',
    sendTxtDesc: 'Archivo de texto con encabezado y diálogos.',
    sendAta: 'Resumen / acta (.txt)',
    sendAtaDesc: 'Acta generada por la IA.',
    sendJson: 'Datos estructurados (.json)',
    sendJsonDesc: 'Payload listo para agentes de IA y automatizaciones.',
    sendAuto: 'Enviar automáticamente al finalizar',
    sendAutoDesc: 'Sube los archivos por su cuenta cuando termina la reunión.',
    lockedTitle: 'Envío al bucket',
    lockedBadge: 'Beta',
    lockedDesc: 'El envío al bucket S3/MinIO llega pronto. Los campos de abajo son una vista previa y están deshabilitados.',
  },

  about: {
    title: 'Acerca de',
    version: (v: string) => `Versión ${v}`,
    desc: 'Captura y organiza los subtítulos de tus reuniones de Google Meet y exporta la transcripción en .txt — directo en el navegador, con privacidad.',
    devBy: 'Desarrollado por DevSync',
    privacy: 'Los datos de la reunión quedan en tu navegador. Nada se envía a servicios externos sin tu acción.',
  },

  history: {
    title: 'Historial de reuniones',
    searchPlaceholder: 'Buscar por título o participante',
    searchAria: 'Buscar',
    privacy: 'El historial se guarda solo en este navegador. Exporta para guardarlo fuera del dispositivo.',
    count: (n: number) => `${n} ${n === 1 ? 'reunión' : 'reuniones'}`,
    notFound: 'No se encontraron reuniones.',
    empty: 'Aún no hay reuniones en el historial.',
    lines: (n: number) => `${n} ${n === 1 ? 'línea' : 'líneas'}`,
    withAta: 'Con acta',
    withoutAta: 'Sin acta',
    local: 'Local',
    favorite: 'Marcar como favorita',
    duration: 'Duración',
    linesChat: 'Líneas / chat',
    chatSuffix: (n: number) => ` · ${n} chat`,
    people: (n: number) => `${n} personas`,
    participants: 'Participantes',
    actions: 'Acciones',
    actionsAi: 'Con IA',
    actionsExport: 'Exportar',
    actionsNoAi: 'Sin IA (experimental)',
    genAtaNoAi: 'Generar resumen sin IA (prueba)',
    genAtaNoAiSub: 'Segmenta por tema, detecta decisiones/acciones/plazos/bloqueos mediante patrones de lenguaje y elimina redundancia — no interpreta el contenido como lo haría una IA',
    genAtaNoAiRegenSub: 'Regenera con el algoritmo actual — reemplaza el resumen existente',
    noAiSummaryTitle: 'Resumen automático (sin IA)',
    noAiSummaryDisclaimer: 'Generado por código determinístico (TextTiling + TextRank + patrones de lenguaje) — las secciones de decisiones/acciones/plazos/bloqueos/preguntas son heurísticas (pueden tener falsos positivos/negativos); no interpreta el contenido como lo haría una IA.',
    noAiSummaryMeeting: 'Reunión',
    noAiSummaryDuration: 'Duración',
    noAiSummaryParticipants: 'Participantes',
    noAiSummaryParticipation: 'Participación',
    noAiSummaryWords: 'palabras',
    noAiSummaryLines: 'intervenciones',
    noAiSummaryExecutive: 'Resumen ejecutivo',
    noAiSummaryTopics: 'Temas discutidos',
    noAiSummaryDecisions: 'Decisiones identificadas (heurística)',
    noAiSummaryActions: 'Acciones / responsables (heurística)',
    noAiSummaryDeadlines: 'Plazos mencionados (heurística)',
    noAiSummaryBlockers: 'Bloqueos (heurística)',
    noAiSummaryQuestions: 'Preguntas abiertas (heurística)',
    noAiSummaryNoneFound: 'Ninguno identificado',
    previewFoot: (n: number) => `Vista previa · ${n} líneas en total`,
    noAtaGenerated: 'Esta reunión no tiene acta generada.',
    dlTxt: 'Descargar transcripción (.txt)',
    dlTxtSub: 'Transcripción original, sin corrección de IA',
    dlAi: 'Descargar .txt con IA',
    dlAiSub: 'Corrige la transcripción (y genera el acta) con IA',
    dlAiSubNoOllama: 'Requiere Ollama conectado',
    dlAiBusy: 'Procesando con IA…',
    dlAiBusySub: 'Puede tardar unos segundos',
    genAta: 'Generar resumen / acta',
    genAtaSub: 'Genera el acta de esta reunión con IA (sin descargar archivo)',
    genAtaSubDone: 'Esta reunión ya tiene acta generada',
    genAtaBusy: 'Generando acta…',
    dlAta: 'Descargar resumen / acta',
    dlAtaSubYes: 'Acta estructurada de esta reunión',
    dlAtaSubNo: 'Esta reunión no tiene acta generada',
    copyWhatsapp: 'Copiar para WhatsApp',
    copyWhatsappSub: 'Copia el acta formateada (negrita, listas, emojis)',
    copyWhatsappSubNo: 'Esta reunión no tiene acta generada',
    copyWhatsappBusy: 'Formateando…',
    copyWhatsappDone: '¡Copiado!',
    del: 'Eliminar del historial',
    delSub: 'Borra la transcripción de este dispositivo',
    meetingFallback: 'Reunión',
    generateTitles: 'Generar títulos con IA',
    generateTitlesHint: (n: number) => `${n} ${n === 1 ? 'reunión sin título' : 'reuniones sin título'} — ¿sugerir con IA?`,
    generatingTitles: (done: number, total: number) => `Generando títulos… ${done}/${total}`,
    generatingTitleCard: 'Generando título…',
    generateAtas: 'Generar actas con IA',
    generateAtasHint: (n: number) => `${n} ${n === 1 ? 'reunión sin acta' : 'reuniones sin acta'} — ¿generar con IA?`,
    generatingAtas: (done: number, total: number) => `Generando actas… ${done}/${total}`,
    importAction: 'Importar reunión',
    importActionSub: 'Carga un backup exportado de otro computador',
    importOk: '¡Reunión importada con éxito!',
    importError: 'Archivo inválido. Selecciona un backup exportado por MeetSync.',
    exportBackup: 'Exportar reunión',
    exportBackupSub: 'Genera un archivo para importar en otro computador, con todo funcionando',
    deleteConfirmTitle: '¿Eliminar esta reunión?',
    deleteConfirmMsg: 'La transcripción se borrará de este dispositivo. Esta acción no se puede deshacer.',
    deleteConfirmYes: 'Eliminar',
    deleteConfirmNo: 'Cancelar',
  },

  popup: {
    privacy: 'Privacidad',
    about: 'Acerca de',
    help: 'Ayuda',
    outsideMsg1Html: 'MeetSync funciona <strong>en Google Meet y Microsoft Teams</strong>.',
    outsideMsg2: 'Entra en una reunión para capturar los subtítulos, ver el chat y exportar la transcripción.',
    idleMsg1Html: 'Estás en una pestaña de <strong>reunión</strong> compatible.',
    idleMsg2: 'Entra en una reunión y la captura de subtítulos empieza automáticamente.',
    goToMeet: 'Ir a Google Meet',
    goToTeams: 'Ir a Microsoft Teams',
    statusIdle: 'Detenido',
    waitingCaptions: 'Esperando subtítulos',
    captureActive: 'Capturando',
    processingAi: 'Procesando (IA)',
    errorAi: 'Error de IA',
    meetingEnded: 'Reunión finalizada',
    lastMeeting: 'Última reunión guardada',
    recSub: (title: string, lines: number, when: string) => `${title} · ${lines} diálogo(s) · ${when}`,
    dlWithAi: 'Descargar con IA',
    dlTxt: 'Descargar .txt',
    dlWithAiTitle: 'Descargar .txt con IA (corrección + resumen)',
    dlTxtTitle: 'Descargar transcripción (.txt)',
    dlWithoutAiTitle: 'Descargar .txt sin IA',
    openHistoryTitle: (n: number) => `Abrir historial de reuniones (${n})`,
    processingOllama: 'Procesando con Ollama…',
    collapsePanel: 'Contraer panel',
    openPanel: 'Abrir panel',
    meetingEndedSub: (n: number) => `Reunión finalizada · ${n} diálogo(s)`,
    inMeetingSub: (entries: number, participants: number) => `${entries} diálogo(s) · ${participants} participante(s)`,
  },

  welcome: {
    docTitle: 'Bienvenido a MeetSync',
    tagline: 'Transcripción de tus reuniones de Google Meet — directo en el navegador.',
    howToUse: 'Cómo usar',
    step1Html: '<strong>Entra en una reunión</strong> de Google Meet. MeetSync aparece en un panel en la esquina de la pantalla.',
    step2Html:
      'Los <strong>subtítulos se activan automáticamente</strong> y empieza la captura — ves los diálogos en tiempo real, como un chat.',
    step3Html:
      'Haz clic en el <strong>icono de MeetSync en la barra de Chrome</strong> en cualquier momento para abrir o contraer el panel.',
    step4Html:
      'Al final, <strong>exporta en .txt o .json</strong>. Opcionalmente, genera corrección y resumen con un servidor <strong>Ollama</strong> local.',
    captureNote: 'La captura nunca toca el audio: MeetSync solo lee los subtítulos que el propio Meet muestra.',
    goToMeet: 'Ir a Google Meet',
    privacy: '🔒 Los datos de la reunión quedan en tu navegador. Nada se envía a servicios externos sin tu acción.',
    privacyPolicy: 'Política de privacidad',
    github: 'GitHub',
  },

  notify: {
    captureStartedTitle: 'MeetSync — captura iniciada',
    capturingCode: (code: string) => `Capturando los subtítulos de ${code}.`,
    capturingMeeting: 'Capturando los subtítulos de la reunión.',
    meetingEndedTitle: 'MeetSync — reunión finalizada',
    transcriptReady: (n: number) =>
      `Transcripción lista${n ? ` (${n} diálogo${n === 1 ? '' : 's'})` : ''}. Abre el panel para revisar y descargar.`,
  },

  exportFile: {
    headerTitle: 'MEETSYNC — TRANSCRIPCIÓN DE LA REUNIÓN',
    transcriptSection: 'TRANSCRIPCIÓN',
    summarySection: 'RESUMEN / ACTA',
    summaryHeaderTitle: 'MEETSYNC — RESUMEN / ACTA DE LA REUNIÓN',
    meeting: 'Reunión',
    link: 'Enlace',
    code: 'Código',
    date: 'Fecha',
    captureStart: 'Inicio de la captura',
    captureEnd: 'Fin de la captura',
    captureDuration: 'Duración de la captura',
    participantsIdentified: 'Participantes identificados',
    notIdentified: '(no identificados)',
    noCaptions: '(sin diálogos capturados)',
    untitledMeeting: 'Reunión sin título',
    chatTag: 'chat',
    filenameMeeting: 'reunion',
    filenameSummarySuffix: '_resumen',
  },

  ai: {
    languageName: 'español',
    correctionPrompt: (vocabulary: string, metadata: string, transcript: string) =>
      `Recibirás una transcripción capturada automáticamente de Google Meet (subtítulos).
Corrige errores de reconocimiento de voz, puntuación y cortes de frase, preservando fielmente el sentido.

Reglas:
- No inventes información ni elimines diálogos relevantes.
- NO cambies el NOMBRE DEL PARTICIPANTE que aparece antes de los dos puntos (el "Nombre:" de cada línea). Corrige solo el TEXTO hablado.
- Conserva los horarios [HH:MM] y el formato de cada línea: [HH:MM] Nombre: texto.
- Escribe la respuesta en español.

Presta especial atención a NOMBRES DE PRODUCTOS, MARCAS, HERRAMIENTAS Y TÉRMINOS TÉCNICOS que la
transcripción automática suele escribir mal — especialmente términos en inglés escuchados como
palabras corrientes. Usa la grafía oficial correcta. Ejemplos del tipo de error a corregir:
- "clod code" / "cloud code" (en contexto de IA/código) → "Claude Code" / "Claude"
- "guithab" → "GitHub";  "paiton" → "Python";  "yavaScript" → "JavaScript";  "olama" → "Ollama"
- "vs code" → "VS Code";  "nod yes" → "Node.js";  "react" → "React"
Usa el CONTEXTO de la conversación (temas técnicos, dev, IA) para inferir el término correcto. Cuando el
término se refiere claramente a un producto/tecnología conocido, prefiere su grafía oficial.
${vocabulary}
Contexto de la reunión (úsalo para entender el tema y desambiguar términos):
${metadata}

IMPORTANTE — formato de la respuesta:
- Responde SOLO con la transcripción corregida, nada más.
- NO incluyas preámbulo, saludo, comentarios, conclusión ni lista de cambios.
- NO agregues títulos, observaciones, notas al pie ni marcas de markdown.
- La primera línea de tu respuesta ya debe ser la primera línea de la transcripción.

Transcripción:
${transcript}`,
    summaryPrompt: (vocabulary: string, metadata: string, transcript: string, stats: string, previous: string) =>
      `Recibirás la transcripción de una reunión.
Genera un acta objetiva y GERENCIAL en español, cubriendo estas secciones EN ESTE ORDEN:

1. Principales temas tratados.
2. Decisiones identificadas.
3. Responsables mencionados.
4. Pendientes (lo que quedó abierto), organizados POR RESPONSABLE — formato "Nombre: pendiente".
5. Bloqueos: para cada uno, indica el ítem bloqueado, el MOTIVO del bloqueo y quién es responsable de resolverlo.
6. Ítems críticos: los que parezcan más urgentes/prioritarios, con el nivel (Alta/Media/Baja) y por qué.
7. Próximos pasos.
${previous ? '8. Continuidad con la reunión anterior: qué se RESOLVIÓ desde entonces, qué SIGUE pendiente, y qué está EN CURSO (compara con el "Acta de la reunión anterior" abajo).\n9. Participación: una línea por persona con el conteo de intervenciones/palabras (dato exacto abajo — NO recalcules, solo organízalo).\n10. Puntos de atención.' : '8. Participación: una línea por persona con el conteo de intervenciones/palabras (dato exacto abajo — NO recalcules, solo organízalo).\n9. Puntos de atención.'}

Reglas:
- No inventes decisiones, responsables, pendientes, bloqueos ni criticidad — básate SOLO en la transcripción.
- Si una sección no tiene contenido (ej.: ningún bloqueo identificado), escribe "Ninguno" en esa sección — no la omitas ni inventes algo.
- Los participantes son EXACTAMENTE los listados en "Participantes" en los datos de abajo (todos hablaron). Enuméralos a TODOS en el acta — no omitas a nadie ni lo degrades a "mencionado" por hablar menos.
- Cuando algo no esté claro, escribe "no identificado en la transcripción".
- Sé directo, profesional y útil.

Datos de la reunión:
${metadata}
${vocabulary}
Estadísticas de participación (dato exacto — úsalo en la sección de Participación, no recalcules):
${stats}
${previous ? `\nActa de la reunión anterior (misma sala — úsala para la sección de Continuidad):\n${previous}\n` : ''}
Transcripción:
${transcript}`,
    askPrompt: (vocabulary: string, metadata: string, transcript: string, conversation: string, question: string) =>
      `Eres un asistente que responde preguntas sobre UNA reunión, basándote ESTRICTAMENTE en la transcripción de abajo (subtítulos capturados automáticamente de Google Meet).

Reglas:
- Responde en español, de forma directa y objetiva.
- Básate SOLO en lo que está en la transcripción. NO inventes nada.
- Si la respuesta no está en la transcripción, di claramente que no se mencionó / no consta en la reunión.
- Cuando ayude, cita quién habló y/o la hora [HH:MM].
- Los participantes de la reunión son EXACTAMENTE los listados en "Participantes" abajo (todos hablaron). Si preguntan quién participó, enuméralos a TODOS — no degrades a nadie a "solo mencionado" por hablar menos.
- La transcripción es automática y puede tener errores de reconocimiento; usa el sentido común.
${vocabulary}
Contexto de la reunión:
${metadata}

Transcripción:
${transcript}
${conversation ? `\nConversación hasta ahora (P = pregunta, R = respuesta):\n${conversation}\n` : ''}
Pregunta: ${question}
Respuesta:`,
    titlePrompt: (vocabulary: string, transcript: string) =>
      `Recibirás la transcripción de una reunión sin título descriptivo definido.
Sugiere un título corto (hasta 8 palabras) que resuma el tema principal, en español.

Reglas:
- Responde SOLO con el título, nada más.
- NO uses comillas, markdown, emojis, puntuación final ni prefijos como "Título:".
- Sé específico sobre el tema tratado — evita algo genérico como "Reunión de equipo" si puedes ser más preciso.
${vocabulary}
Transcripción:
${transcript}`,
    whatsappPrompt: (ata: string) =>
      `Recibirás el acta de una reunión YA LISTA. Reformatea ESE MISMO CONTENIDO para pegar en un
chat de WhatsApp — sin resumir más, sin agregar ni quitar ninguna información.

Reglas de formato de WhatsApp (usa exactamente este estilo):
- Negrita: *un asterisco* a cada lado (NUNCA **dos**, eso es markdown y no funciona en WhatsApp).
- Cada sección (ej.: Decisiones, Pendientes, Bloqueos, Ítems críticos, Participación, Próximos
  pasos) se convierte en un título en *negrita, MAYÚSCULA*, con un emoji relevante antes (ej.: ✅
  Decisiones, 📌 Pendientes, 🚧 Bloqueos, 🔴 Críticos, 🗣️ Participación, 👉 Próximos pasos).
- Las listas usan "• " al inicio de cada ítem (no uses "-" ni "*" ni numeración markdown).
- No inventes, no resumas más, no quites NINGUNA información del acta original — solo reformatea.
- Responde SOLO con el texto final formateado, sin preámbulo, sin comentario, sin explicación.

Acta original:
${ata}`,
    vocabularyClause: (terms: string) =>
      `\nVOCABULARIO DEL NEGOCIO — nombres de empresas, productos y siglas del usuario. La transcripción
automática de Google suele escribir mal estos términos (ej.: "acme corp" → "AcmeCorp"). Cuando una
palabra del texto no tenga sentido y se parezca (fonética o gráficamente) a uno de estos, corrígela a la
grafía EXACTA de abajo. Úsalos también para entender el contexto. Términos: ${terms}.\n`,
    meta: {
      meeting: 'Reunión',
      link: 'Enlace',
      code: 'Código',
      date: 'Fecha',
      start: 'Inicio',
      end: 'Fin',
      inProgress: '(en curso)',
      participants: 'Participantes',
      untitled: 'sin título',
    },
    alertPrompt: (interests: string, lines: string) =>
      [
        'Monitoreas una reunión para un participante que NO está prestando atención ahora.',
        'Avísale solo cuando algo en los diálogos toque uno de los intereses de abajo.',
        '',
        'Intereses monitoreados (numerados):',
        interests,
        '',
        'Diálogos recientes de otras personas en la reunión:',
        lines,
        '',
        'Responde SOLO con un JSON válido, sin texto antes ni después, en el formato:',
        '{"relevante": true|false, "regra": <número del interés que coincidió o null>, "motivo": "frase corta en español"}',
        'Usa "relevante": true solo si los diálogos realmente tocan algún interés.',
      ].join('\n'),
  },
};
