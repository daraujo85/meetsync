import type { Messages } from './pt';

export const en: Messages = {
  _bcp47: 'en-US',

  langName: { pt: 'Portuguese', en: 'English', es: 'Spanish' },

  compact: {
    logoTitle: 'MeetSync · drag to move',
    openPanel: 'Open MeetSync panel',
    openPanelAria: 'Open panel',
    captionsToggle: 'Turn captions on/off',
    captionsAria: 'Captions',
    downloadTxt: 'Download transcript (.txt)',
    downloadAria: 'Download',
    alertsBell: 'Mention alerts',
    alertsAria: 'Alerts',
    paused: 'Paused',
  },

  header: {
    history: 'Meeting history',
    about: 'About MeetSync',
    aboutAria: 'About',
    collapse: 'Collapse panel',
    collapseAria: 'Collapse',
    beta: 'Beta',
    back: 'Back',
    ask: 'Ask the meeting',
  },
  ask: {
    title: 'Ask the meeting',
    subtitle: 'Answers based on the captured transcript',
    placeholder: 'E.g.: did Lucas mention the payoff?',
    send: 'Send',
    emptyTitle: 'Ask anything about this meeting',
    emptyDesc: 'The AI answers based on what was captured in the transcript.',
    ex1: 'What were the decisions?',
    ex2: 'What was left pending?',
    ex3: 'Did anyone mention deadlines?',
    requiresOllama: 'Connect Ollama (Export tab) to ask.',
    noTranscript: 'No transcript captured yet to ask about.',
    error: 'Could not answer right now. Check Ollama and try again.',
    historyAction: 'Ask the meeting',
    historyActionSub: 'Ask the AI about this meeting',
  },

  events: {
    raisedHand: 'raised their hand ✋',
    reacted: (emoji: string) => `reacted ${emoji}`,
    someone: 'Someone',
  },

  tabs: {
    transcript: 'Transcript',
    alerts: 'Alerts',
    summary: 'Summary',
    export: 'Export',
    upload: 'Upload',
    beta: 'beta',
  },

  statusStrip: { captions: 'Captions' },

  transcript: {
    empty: 'No speech captured yet. Turn on Meet captions to start.',
    jumpToEnd: 'Jump to end',
  },

  summaryTab: {
    rtTitle: 'Real-time summary',
    rtHelp: 'Updates the minutes automatically, via Ollama streaming.',
    updateEvery: 'Update every',
    min: 'min',
  },

  captureStatus: {
    active: 'Capturing',
    processing: 'Processing',
    errorShort: 'AI error',
    paused: 'Paused',
    endedStrip: 'Meeting ended — review and download below',
    processingEllipsis: 'Processing…',
    errorProcessing: 'Error processing AI',
    capturePaused: 'Capture paused',
  },

  tail: {
    ended: 'Meeting ended — this transcript stays here until you leave the tab.',
    capturing: 'Capturing captions in real time…',
    paused: 'Capture paused — turn on captions to continue',
  },

  alerts: {
    monitorTitle: 'Monitor the meeting',
    listening: 'Listening · you’ll be alerted even when distracted',
    pausedSub: 'Paused · no alerts will fire',
    playSound: 'Play sound on alert',
    watchedExpr: 'Watched expressions',
    addExpr: 'Add expression',
    keyword: 'Word / phrase',
    aiContext: 'AI by context',
    newExprAria: 'New expression',
    add: 'Add',
    keywordLabel: 'Word or phrase',
    aiLabel: 'Monitored context',
    recentDetections: 'Recent detections',
    noExpr: 'No expressions. Add one below.',
    badgeAi: 'AI',
    badgePhrase: 'phrase',
    noTermsYet: 'No terms yet — add some below.',
    requiresOllama: 'Requires Ollama configured in the Export tab.',
    simulate: 'Simulate detection',
    remove: 'Remove',
    placeholderKeyword: 'e.g.: my name, budget, deadline…',
    placeholderAi: 'e.g.: when they ask for a decision from me',
    helpKeyword: 'Fires when someone (other than you) says the word or phrase. Separate variations with commas.',
    helpAi: 'The AI watches the context in real time and fires when the meaning matches — it doesn’t need the exact phrase.',
    demoWho: 'Participant',
    demoTimeNow: 'now',
    demoReasonKeyword: (term: string) => `They mentioned "${term}"`,
    demoReasonAi: (label: string) => `AI · ${label}`,
    demoTextKeyword: (term: string) => `…I think we need to look at "${term}" carefully before deciding.`,
    demoTextAi: '…that depends on you, can you confirm by tomorrow so we can move forward?',
  },

  overlay: {
    dismissAria: 'Dismiss',
    goToMeeting: 'Go to the meeting',
    dismiss: 'Dismiss',
    detectionAi: 'AI detection',
    meetingAlert: 'Meeting alert',
  },

  exportTab: {
    capturePrefs: 'Capture preferences',
    autoStart: 'Start capturing automatically',
    autoStartDesc: 'When you join the meeting, turns on captions and starts capturing.',
    autoChat: 'Capture text chat',
    autoChatDesc: 'Opens the Meet chat automatically when a new message arrives.',
    header: 'Include header',
    headerDesc: 'Meeting, link, code, date, times and participants.',
    correct: 'Correct with AI',
    correctDesc: 'Fixes punctuation and recognition errors, without inventing content.',
    summary: 'Include summary / minutes',
    summaryDesc: 'Adds a structured summary at the end of the file.',
    separate: 'Generate separate summary file',
    separateDesc: 'Downloads the minutes as a second .txt file.',
    json: 'Structured data (.json)',
    jsonDesc: 'Also downloads a JSON ready for AI agents and automations.',
    exportOptions: 'Export options',
    language: 'Language',
    languageDesc: 'Language of the interface, exports and AI responses.',
    yourName: 'Your name',
    yourNamePlaceholder: 'e.g.: Diego Araujo',
    yourNameDesc: 'Shown instead of “You” in the transcript, exports and summaries.',
    vocabTitle: 'Business vocabulary',
    vocabDescHtml:
      'Company names, products and acronyms from your everyday work. The AI uses this list to fix words the Google transcript got wrong — e.g.: <span class="ms-vocab-ex">"acme corp" → "Acme"</span>.',
    vocabPlaceholder: 'e.g.: Acme, Globex, OKRs…',
    vocabAdd: 'Add',
    vocabEmpty: 'No terms yet. Add some below.',
    vocabNewAria: 'New term',
    vocabAppliedActive: (n: number) =>
      `Will be applied when correcting the transcript and in the summary (${n} ${n === 1 ? 'term' : 'terms'}).`,
    vocabAppliedInactive: 'Applied automatically when “Correct with AI” or the summary are active.',
    ollamaTitle: 'Ollama integration',
    serverUrl: 'Server URL',
    ollamaUrlAria: 'Ollama URL',
    test: 'Test',
    model: 'Model',
    ollamaPrivacy: 'Content is only sent to the Ollama URL when AI is active. Nothing goes to external services.',
    testToList: 'Test the connection to list the models.',
    preview: 'File preview',
    previewTranscript: 'Transcript',
    previewSummary: 'Summary',
    previewAtaEmpty: 'Generate the summary/minutes (Summary tab or on download) to see the preview here.',
    noteRequiresOllamaModel: 'Requires Ollama configured and a model selected.',
    noteRequiresOllama: 'Requires Ollama configured.',
    noteEnableSummaryFirst: 'Enable “Include summary / minutes” first.',
  },

  ollamaStatus: {
    connecting: 'Connecting to the server…',
    error: (msg: string) => `Error: ${msg}`,
    connected: (n: number) => `Connected — ${n} models`,
    notConnected: 'Not connected',
    correctionFailed: (msg: string) => `Correction failed: ${msg}`,
    summaryFailed: (msg: string) => `Summary failed: ${msg}`,
  },

  seedWatch: {
    nameLabel: 'Mention of your name',
    sharedLabel: 'They talked about what you shared',
    sharedDesc: 'Detects when they mention the screen, spreadsheet or document you presented.',
    decisionLabel: 'They asked for a decision or action from you',
    decisionDesc: 'Alerts when the context indicates they expect an answer or approval from you.',
  },

  summaryContent: {
    configureOllama: 'Configure an Ollama server in the Export tab and pick a model to generate the minutes.',
    enableRt: 'Enable “Real-time summary” above, or generate the minutes on download.',
    rtActiveWaiting: 'Real-time summary active ✓ Waiting for the first speech…',
    rtActiveSoon: 'Real-time summary active ✓ The minutes will be generated shortly.',
  },

  rtStatus: {
    generating: 'Generating summary · waiting for Ollama…',
    waitingFirst: 'Waiting for the first speech…',
    updating: 'Updating…',
    live: (mmss: string, pending: boolean) => `Live · next in ${mmss}${pending ? ' · new speech' : ''}`,
  },

  footer: {
    processingOllama: 'Processing with Ollama…',
    downloadAi: 'Download .txt with AI',
    downloadTxt: 'Download transcript (.txt)',
    downloadTxtShort: 'Download .txt',
    downloadWithoutAi: 'Download without AI',
  },

  upload: {
    providerS3: 'Amazon S3',
    providerMinio: 'MinIO',
    sendNow: 'Send now',
    purpose:
      'Send the transcript to an S3/MinIO bucket — a common destination for AI agents and automated routines to consume meetings.',
    bucketDest: 'Bucket destination',
    endpoint: 'Endpoint',
    region: 'Region',
    bucket: 'Bucket',
    accessKey: 'Access Key ID',
    secretKey: 'Secret Access Key',
    prefix: 'Prefix / folder (optional)',
    prefixPlaceholder: 'transcripts/',
    whatToSend: 'What to send',
    sendTxt: 'Transcript (.txt)',
    sendTxtDesc: 'Text file with header and speech.',
    sendAta: 'Summary / minutes (.txt)',
    sendAtaDesc: 'Minutes generated by AI.',
    sendJson: 'Structured data (.json)',
    sendJsonDesc: 'Payload ready for AI agents and automations.',
    sendAuto: 'Send automatically when the meeting ends',
    sendAutoDesc: 'Uploads the files on its own when the meeting ends.',
    lockedTitle: 'Bucket upload',
    lockedBadge: 'Beta',
    lockedDesc: 'S3/MinIO bucket upload is coming soon. The fields below are a preview and are disabled.',
  },

  about: {
    title: 'About',
    version: 'Version MVP 0.1',
    desc: 'Captures and organizes the captions of your Google Meet meetings and exports the transcript as .txt — right in the browser, privately.',
    devBy: 'Built by DevSync',
    privacy: 'Meeting data stays in your browser. Nothing is sent to external services without your action.',
  },

  history: {
    title: 'Meeting history',
    searchPlaceholder: 'Search by title or participant',
    searchAria: 'Search',
    privacy: 'History is saved only in this browser. Export to keep it off the device.',
    count: (n: number) => `${n} ${n === 1 ? 'meeting' : 'meetings'}`,
    notFound: 'No meetings found.',
    empty: 'No meetings in history yet.',
    lines: (n: number) => `${n} ${n === 1 ? 'line' : 'lines'}`,
    withAta: 'With minutes',
    withoutAta: 'No minutes',
    local: 'Local',
    favorite: 'Favorite',
    duration: 'Duration',
    linesChat: 'Lines / chat',
    chatSuffix: (n: number) => ` · ${n} chat`,
    people: (n: number) => `${n} people`,
    participants: 'Participants',
    actions: 'Actions',
    actionsAi: 'With AI',
    actionsExport: 'Export',
    previewFoot: (n: number) => `Preview · ${n} lines in total`,
    noAtaGenerated: 'This meeting has no generated minutes.',
    dlTxt: 'Download transcript (.txt)',
    dlTxtSub: 'Original transcript, no AI correction',
    dlAi: 'Download .txt with AI',
    dlAiSub: 'Corrects the transcript (and generates minutes) with AI',
    dlAiSubNoOllama: 'Requires Ollama connected',
    dlAiBusy: 'Processing with AI…',
    dlAiBusySub: 'May take a few seconds',
    genAta: 'Generate summary / minutes',
    genAtaSub: 'Generates this meeting\'s minutes with AI (no file download)',
    genAtaSubDone: 'This meeting already has generated minutes',
    genAtaBusy: 'Generating minutes…',
    dlAta: 'Download summary / minutes',
    dlAtaSubYes: 'Structured minutes for this meeting',
    dlAtaSubNo: 'This meeting has no generated minutes',
    del: 'Delete from history',
    delSub: 'Erases the transcript from this device',
    meetingFallback: 'Meeting',
    generateTitles: 'Generate titles with AI',
    generateTitlesHint: (n: number) => `${n} untitled ${n === 1 ? 'meeting' : 'meetings'} — suggest with AI?`,
    generatingTitles: (done: number, total: number) => `Generating titles… ${done}/${total}`,
    importAction: 'Import meeting',
    importActionSub: 'Loads a backup exported from another computer',
    importOk: 'Meeting imported successfully!',
    importError: 'Invalid file. Select a backup exported by MeetSync.',
    exportBackup: 'Export meeting',
    exportBackupSub: 'Generates a file to import on another computer, with everything working',
    deleteConfirmTitle: 'Delete this meeting?',
    deleteConfirmMsg: 'The transcript will be erased from this device. This action cannot be undone.',
    deleteConfirmYes: 'Delete',
    deleteConfirmNo: 'Cancel',
  },

  popup: {
    privacy: 'Privacy',
    help: 'Help',
    outsideMsg1Html: 'MeetSync works <strong>on Google Meet and Microsoft Teams</strong>.',
    outsideMsg2: 'Join a meeting to capture captions, see the chat and export the transcript.',
    idleMsg1Html: 'You’re on a supported <strong>meeting</strong> tab.',
    idleMsg2: 'Join a meeting and caption capture starts automatically.',
    goToMeet: 'Go to Google Meet',
    goToTeams: 'Go to Microsoft Teams',
    statusIdle: 'Stopped',
    waitingCaptions: 'Waiting for captions',
    captureActive: 'Capturing',
    processingAi: 'Processing (AI)',
    errorAi: 'AI error',
    meetingEnded: 'Meeting ended',
    lastMeeting: 'Last saved meeting',
    recSub: (title: string, lines: number, when: string) => `${title} · ${lines} line(s) · ${when}`,
    dlWithAi: 'Download with AI',
    dlTxt: 'Download .txt',
    dlWithAiTitle: 'Download .txt with AI (correction + summary)',
    dlTxtTitle: 'Download transcript (.txt)',
    dlWithoutAiTitle: 'Download .txt without AI',
    openHistoryTitle: (n: number) => `Open meeting history (${n})`,
    processingOllama: 'Processing with Ollama…',
    collapsePanel: 'Collapse panel',
    openPanel: 'Open panel',
    meetingEndedSub: (n: number) => `Meeting ended · ${n} line(s)`,
    inMeetingSub: (entries: number, participants: number) => `${entries} line(s) · ${participants} participant(s)`,
  },

  welcome: {
    docTitle: 'Welcome to MeetSync',
    tagline: 'Transcripts of your Google Meet meetings — right in the browser.',
    howToUse: 'How to use',
    step1Html: '<strong>Join a meeting</strong> on Google Meet. MeetSync appears in a panel in the corner of the screen.',
    step2Html:
      'Captions are <strong>turned on automatically</strong> and capture begins — you see speech in real time, like a chat.',
    step3Html:
      'Click the <strong>MeetSync icon in the Chrome toolbar</strong> at any time to open or collapse the panel.',
    step4Html:
      'When you’re done, <strong>export as .txt or .json</strong>. Optionally, generate correction and summary with a local <strong>Ollama</strong> server.',
    captureNote: 'Capture never touches the audio: MeetSync only reads the captions Meet already displays.',
    goToMeet: 'Go to Google Meet',
    privacy: '🔒 Meeting data stays in your browser. Nothing is sent to external services without your action.',
    privacyPolicy: 'Privacy policy',
    github: 'GitHub',
  },

  notify: {
    captureStartedTitle: 'MeetSync — capture started',
    capturingCode: (code: string) => `Capturing the captions of ${code}.`,
    capturingMeeting: 'Capturing the meeting captions.',
    meetingEndedTitle: 'MeetSync — meeting ended',
    transcriptReady: (n: number) =>
      `Transcript ready${n ? ` (${n} line${n === 1 ? '' : 's'})` : ''}. Open the panel to review and download.`,
  },

  exportFile: {
    headerTitle: 'MEETSYNC — MEETING TRANSCRIPT',
    transcriptSection: 'TRANSCRIPT',
    summarySection: 'SUMMARY / MINUTES',
    summaryHeaderTitle: 'MEETSYNC — MEETING SUMMARY / MINUTES',
    meeting: 'Meeting',
    link: 'Link',
    code: 'Code',
    date: 'Date',
    captureStart: 'Capture start',
    captureEnd: 'Capture end',
    captureDuration: 'Capture duration',
    participantsIdentified: 'Identified participants',
    notIdentified: '(not identified)',
    noCaptions: '(no speech captured)',
    untitledMeeting: 'Untitled meeting',
    chatTag: 'chat',
    filenameMeeting: 'meeting',
    filenameSummarySuffix: '_summary',
  },

  ai: {
    languageName: 'English',
    correctionPrompt: (vocabulary: string, metadata: string, transcript: string) =>
      `You will receive a transcript automatically captured from Google Meet (captions).
Fix speech-recognition errors, punctuation and sentence breaks, faithfully preserving the meaning.

Rules:
- Do not invent information or remove relevant speech.
- DO NOT change the PARTICIPANT NAME that appears before the colon (the "Name:" of each line). Correct only the SPOKEN TEXT.
- Preserve the [HH:MM] timestamps and the format of each line: [HH:MM] Name: text.
- Write the response in English.

Pay special attention to PRODUCT NAMES, BRANDS, TOOLS AND TECHNICAL TERMS that automatic
transcription often misspells — especially English terms heard as ordinary words. Use the correct
official spelling. Examples of the kind of error to fix:
- "clawed code" / "cloud code" (in an AI/code context) → "Claude Code" / "Claude"
- "get hub" → "GitHub";  "pie thon" → "Python";  "java script" → "JavaScript";  "oh lama" → "Ollama"
- "vs code" → "VS Code";  "node js" → "Node.js";  "react" → "React"
Use the CONTEXT of the conversation (technical, dev, AI topics) to infer the correct term. When the
term clearly refers to a known product/technology, prefer its official spelling.
${vocabulary}
Meeting context (use it to understand the topic and disambiguate terms):
${metadata}

IMPORTANT — response format:
- Respond ONLY with the corrected transcript, nothing else.
- DO NOT include a preamble, greeting, comments, conclusion or list of changes.
- DO NOT add titles, notes, footnotes or markdown markup.
- The first line of your response must already be the first line of the transcript.

Transcript:
${transcript}`,
    summaryPrompt: (vocabulary: string, metadata: string, transcript: string, stats: string, previous: string) =>
      `You will receive the transcript of a meeting.
Generate objective, MANAGERIAL minutes in English, covering these sections IN THIS ORDER:

1. Main topics discussed.
2. Decisions identified.
3. Owners mentioned.
4. Pending items (what's still open), organized BY OWNER — format "Name: pending item".
5. Blockers: for each one, cite the blocked item, the REASON for the block, and who owns resolving it.
6. Critical items: the ones that look most urgent/important, with a level (High/Medium/Low) and why.
7. Next steps.
${previous ? '8. Continuity with the previous meeting: what was RESOLVED since then, what is STILL pending, and what is IN PROGRESS (compare with the "Previous meeting minutes" below).\n9. Participation: one line per person with speech/word counts (exact data below — do NOT recalculate, just organize it).\n10. Points of attention.' : '8. Participation: one line per person with speech/word counts (exact data below — do NOT recalculate, just organize it).\n9. Points of attention.'}

Rules:
- Do not invent decisions, owners, pending items, blockers or criticality — rely ONLY on the transcript.
- If a section has no content (e.g., no blockers identified), write "None" for that section — do not skip or invent something.
- The participants are EXACTLY those listed under "Participants" in the data below (they all spoke). List ALL of them in the minutes — do not omit anyone or demote them to "mentioned" for speaking less.
- When something is unclear, write "not identified in the transcript".
- Be direct, professional and useful.

Meeting data:
${metadata}
${vocabulary}
Participation statistics (exact data — use in the Participation section, do not recalculate):
${stats}
${previous ? `\nPrevious meeting minutes (same room — use for the Continuity section):\n${previous}\n` : ''}
Transcript:
${transcript}`,
    askPrompt: (vocabulary: string, metadata: string, transcript: string, conversation: string, question: string) =>
      `You are an assistant that answers questions about ONE meeting, based STRICTLY on the transcript below (captions automatically captured from Google Meet).

Rules:
- Answer in English, directly and objectively.
- Rely ONLY on what is in the transcript. Do NOT make anything up.
- If the answer is not in the transcript, clearly say it was not mentioned / is not in the meeting.
- When helpful, cite who spoke and/or the timestamp [HH:MM].
- The meeting participants are EXACTLY those listed under "Participants" below (they all spoke). If asked who attended, list ALL of them — do not demote anyone to "merely mentioned" just because they spoke less.
- The transcript is automatic and may have recognition errors; use common sense.
${vocabulary}
Meeting context:
${metadata}

Transcript:
${transcript}
${conversation ? `\nConversation so far (Q = question, A = answer):\n${conversation}\n` : ''}
Question: ${question}
Answer:`,
    titlePrompt: (vocabulary: string, transcript: string) =>
      `You will receive the transcript of a meeting with no descriptive title set.
Suggest a short title (up to 8 words) that summarizes the main topic, in English.

Rules:
- Reply ONLY with the title, nothing else.
- Do NOT use quotes, markdown, emojis, trailing punctuation or prefixes like "Title:".
- Be specific to the topic discussed — avoid something generic like "Team meeting" if you can be more precise.
${vocabulary}
Transcript:
${transcript}`,
    vocabularyClause: (terms: string) =>
      `\nBUSINESS VOCABULARY — company names, products and acronyms used by the user. Automatic Google
transcription often misspells these terms (e.g.: "acme corp" → "AcmeCorp"). When a word in the text
doesn't make sense and looks (phonetically or in spelling) like one of these, correct it to the EXACT
spelling below. Also use it to understand the context. Terms: ${terms}.\n`,
    meta: {
      meeting: 'Meeting',
      link: 'Link',
      code: 'Code',
      date: 'Date',
      start: 'Start',
      end: 'End',
      inProgress: '(in progress)',
      participants: 'Participants',
      untitled: 'untitled',
    },
    alertPrompt: (interests: string, lines: string) =>
      [
        'You monitor a meeting for a participant who is NOT paying attention right now.',
        'Alert them only when something in the speech touches on one of the interests below.',
        '',
        'Monitored interests (numbered):',
        interests,
        '',
        'Recent speech from other people in the meeting:',
        lines,
        '',
        'Respond ONLY with valid JSON, with no text before or after, in the format:',
        '{"relevante": true|false, "regra": <number of the interest that matched or null>, "motivo": "short phrase in English"}',
        'Use "relevante": true only if the speech really touches on an interest.',
      ].join('\n'),
  },
};
