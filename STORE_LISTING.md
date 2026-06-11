# Chrome Web Store — Ficha do MeetSync (copiar/colar)

## Identidade
- **Nome:** MeetSync
- **Categoria:** Produtividade (Productivity)
- **Idioma principal:** Português (Brasil)
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
• Histórico em formato de chat: quem falou, quando e o quê, com avatares e links clicáveis.
• Mensagens do chat de texto entram intercaladas na transcrição.
• Exportação em .txt (com cabeçalho opcional) e .json estruturado para automações/agentes de IA.
• Resumo/ata e correção da transcrição OPCIONAIS, via um servidor Ollama local que você configura.
• Após a reunião, o painel continua na tela para você revisar e baixar com calma.

Privacidade: os dados ficam no seu navegador. Nada é enviado para servidores externos — exceto, se você ativar a IA, para o endereço do Ollama que você mesmo configurar.

Não captura áudio bruto, não grava tela e não usa rastreadores.

## Propósito único (Single purpose)
Capturar, organizar e exportar a transcrição (legendas e chat) de reuniões do Google Meet.

## Justificativa das permissões (campo "Privacy practices")
- **storage:** salvar localmente as preferências do usuário (URL/modelo do Ollama, opções de exportação).
- **downloads:** exportar a transcrição/ata como arquivos .txt e .json.
- **host meet.google.com:** ler as legendas e o chat exibidos na própria página da reunião — função central da extensão.
- **host localhost / 127.0.0.1:** comunicar-se, apenas quando o usuário ativa a IA, com um servidor Ollama na máquina do próprio usuário, para correção/resumo da transcrição.
- **Uso de dados:** a extensão NÃO coleta dados de navegação, NÃO usa analytics e NÃO compartilha/vende dados. O conteúdo da reunião só sai do navegador se o usuário ativar a IA, e somente para a URL do Ollama configurada por ele.

## Screenshots sugeridos (1280×800)
1. Painel expandido com a aba Transcrição (chat) durante uma reunião.
2. Aba Resumo com a ata em tempo real.
3. Aba Exportar (opções + Ollama + prévia).
