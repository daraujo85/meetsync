# Chrome Web Store — Ficha do MeetSync (copiar/colar)

## Identidade
- **Nome:** MeetSync
- **Categoria:** Produtividade (Productivity)
- **Idioma principal:** Português (Brasil) — também disponível em Inglês e Espanhol (nome/descrição localizados via `_locales`; a Web Store exibe conforme o idioma do usuário).
- **Idiomas suportados:** `pt_BR`, `en`, `es`
- **Ícone da loja (128×128):** `public/icons/store-icon-128.png`
- **Política de privacidade (URL):** `https://daraujo85.github.io/meetsync/privacy.html`
  (ativar GitHub Pages: Settings → Pages → Branch `master`, pasta `/docs`)

## Descrição curta (≤ 132 caracteres)
Captura as legendas do Google Meet, exibe em chat e exporta em .txt/.json, com correção e resumo opcionais via Ollama.

## Descrição detalhada
O MeetSync captura automaticamente as legendas e as mensagens de chat exibidas pelo próprio Google Meet, organiza tudo como uma conversa em ordem cronológica e permite exportar a reunião em .txt e .json — direto no navegador, sem gravar áudio nem tela.

Recursos:
• Barra discreta e painel em Dark Mode, integrados ao visual do Meet (e arrastáveis).
• Liga as legendas automaticamente e captura enquanto estiverem ativas; pausa/retoma com elas.
• Transcrição em formato de chat: quem falou, quando e o quê, com avatares e links clicáveis.
• Mensagens do chat de texto entram intercaladas, em ordem cronológica.
• Alertas de menção: avise-se quando alguém falar seu nome, uma palavra/frase ou (com IA) um assunto de interesse — útil quando você está em outra aba.
• Histórico de reuniões: biblioteca local com busca para revisitar, baixar e gerenciar transcrições anteriores.
• Exportação em .txt (com cabeçalho opcional) e .json estruturado para automações/agentes de IA.
• Resumo/ata e correção da transcrição OPCIONAIS, via um servidor Ollama local que você configura.
• Vocabulário do negócio: cadastre nomes, produtos e siglas para a IA corrigir palavras mal-transcritas.
• "Seu nome" aparece no lugar de "Você" na transcrição, exportações e resumos.
• Rede de segurança: a transcrição é salva localmente e pode ser recuperada se a aba fechar/recarregar.
• Após a reunião, o painel continua na tela para você revisar e baixar com calma.

Privacidade: os dados ficam no seu navegador. Nada é enviado para servidores externos — exceto, se você ativar a IA, para o endereço do Ollama que você mesmo configurar.

Não captura áudio bruto, não grava tela e não usa rastreadores.

## Propósito único (Single purpose)
Capturar, organizar e exportar a transcrição (legendas e chat) de reuniões do Google Meet.

## Justificativa das permissões (campo "Privacy practices")
- **storage:** salvar localmente as preferências do usuário (URL/modelo do Ollama, opções de exportação).
- **downloads:** exportar a transcrição/ata como arquivos .txt e .json.
- **notifications:** avisar o usuário quando a captura de uma reunião começa e quando a reunião termina (transcrição pronta para revisar/baixar) — feedback local, sem coleta de dados.
- **host meet.google.com:** ler as legendas e o chat exibidos na própria página da reunião — função central da extensão.
- **host localhost / 127.0.0.1:** comunicar-se, apenas quando o usuário ativa a IA, com um servidor Ollama na máquina do próprio usuário, para correção/resumo da transcrição.
- **Uso de dados:** a extensão NÃO coleta dados de navegação, NÃO usa analytics e NÃO compartilha/vende dados. O conteúdo da reunião só sai do navegador se o usuário ativar a IA, e somente para a URL do Ollama configurada por ele.

## Screenshots sugeridos (1280×800)
1. Painel expandido com a aba Transcrição (chat) durante uma reunião.
2. Aba Alertas (regras monitoradas) + banner de alerta disparado.
3. Histórico de reuniões (lista) e/ou o detalhe de uma reunião.
4. Aba Resumo com a ata em tempo real.
5. Aba Exportar (Vocabulário do negócio + Ollama + prévia).

---

# Chrome Web Store — MeetSync listing (English)

## Short description (≤ 132 characters)
Captures Google Meet captions, shows them as a chat and exports to .txt/.json, with optional AI correction and summary via Ollama.

## Detailed description
MeetSync automatically captures the captions and chat messages that Google Meet already displays, organizes everything as a chronological conversation and lets you export the meeting to .txt and .json — right in the browser, without recording audio or screen.

Features:
• Discreet bar and Dark Mode panel, blended into Meet’s look (and draggable).
• Turns captions on automatically and captures while they’re active; pauses/resumes with them.
• Chat-style transcript: who spoke, when and what, with avatars and clickable links.
• Text chat messages are interleaved in chronological order.
• Mention alerts: get notified when someone says your name, a word/phrase or (with AI) a topic of interest — handy when you’re in another tab.
• Meeting history: a local, searchable library to revisit, download and manage past transcripts.
• Export as .txt (with optional header) and structured .json for automations / AI agents.
• OPTIONAL summary/minutes and transcript correction, via a local Ollama server you configure.
• Business vocabulary: add names, products and acronyms for the AI to fix mis-transcribed words.
• "Your name" appears instead of "You" in the transcript, exports and summaries.
• Safety net: the transcript is saved locally and can be recovered if the tab closes/reloads.
• After the meeting, the panel stays on screen so you can review and download at your own pace.

Privacy: data stays in your browser. Nothing is sent to external servers — except, if you enable AI, to the Ollama address you configure yourself.

It does not capture raw audio, does not record the screen and uses no trackers.

## Single purpose
Capture, organize and export the transcript (captions and chat) of Google Meet meetings.

## Permission justifications
- **storage:** save user preferences locally (Ollama URL/model, export options).
- **downloads:** export the transcript/minutes as .txt and .json files.
- **notifications:** tell the user when a meeting’s capture starts and when it ends (transcript ready to review/download) — local feedback, no data collection.
- **host meet.google.com:** read the captions and chat shown on the meeting page — the extension’s core function.
- **host localhost / 127.0.0.1:** communicate, only when the user enables AI, with an Ollama server on the user’s own machine, for transcript correction/summary.
- **Data use:** the extension does NOT collect browsing data, does NOT use analytics and does NOT share/sell data. Meeting content only leaves the browser if the user enables AI, and only to the Ollama URL they configured.

---

# Chrome Web Store — ficha de MeetSync (Español)

## Descripción corta (≤ 132 caracteres)
Captura los subtítulos de Google Meet, los muestra como chat y exporta a .txt/.json, con corrección y resumen opcionales vía Ollama.

## Descripción detallada
MeetSync captura automáticamente los subtítulos y los mensajes de chat que el propio Google Meet muestra, organiza todo como una conversación en orden cronológico y permite exportar la reunión en .txt y .json — directo en el navegador, sin grabar audio ni pantalla.

Funciones:
• Barra discreta y panel en Modo Oscuro, integrados al aspecto de Meet (y arrastrables).
• Activa los subtítulos automáticamente y captura mientras estén activos; pausa/reanuda con ellos.
• Transcripción tipo chat: quién habló, cuándo y qué, con avatares y enlaces clicables.
• Los mensajes del chat de texto se intercalan en orden cronológico.
• Alertas de mención: entérate cuando alguien diga tu nombre, una palabra/frase o (con IA) un tema de interés — útil cuando estás en otra pestaña.
• Historial de reuniones: una biblioteca local con búsqueda para revisitar, descargar y gestionar transcripciones anteriores.
• Exportación en .txt (con encabezado opcional) y .json estructurado para automatizaciones / agentes de IA.
• Resumen/acta y corrección de la transcripción OPCIONALES, vía un servidor Ollama local que tú configuras.
• Vocabulario del negocio: agrega nombres, productos y siglas para que la IA corrija palabras mal transcritas.
• "Tu nombre" aparece en lugar de "Tú" en la transcripción, las exportaciones y los resúmenes.
• Red de seguridad: la transcripción se guarda localmente y puede recuperarse si la pestaña se cierra/recarga.
• Tras la reunión, el panel permanece en pantalla para que revises y descargues con calma.

Privacidad: los datos quedan en tu navegador. Nada se envía a servidores externos — excepto, si activas la IA, a la dirección de Ollama que tú mismo configures.

No captura audio en bruto, no graba la pantalla y no usa rastreadores.

## Propósito único
Capturar, organizar y exportar la transcripción (subtítulos y chat) de reuniones de Google Meet.

## Justificación de los permisos
- **storage:** guardar localmente las preferencias del usuario (URL/modelo de Ollama, opciones de exportación).
- **downloads:** exportar la transcripción/acta como archivos .txt y .json.
- **notifications:** avisar al usuario cuando empieza la captura de una reunión y cuando termina (transcripción lista para revisar/descargar) — feedback local, sin recolección de datos.
- **host meet.google.com:** leer los subtítulos y el chat mostrados en la página de la reunión — función central de la extensión.
- **host localhost / 127.0.0.1:** comunicarse, solo cuando el usuario activa la IA, con un servidor Ollama en la propia máquina del usuario, para corrección/resumen de la transcripción.
- **Uso de datos:** la extensión NO recopila datos de navegación, NO usa analytics y NO comparte/vende datos. El contenido de la reunión solo sale del navegador si el usuario activa la IA, y únicamente hacia la URL de Ollama configurada por él.
