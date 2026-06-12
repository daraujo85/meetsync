# MeetSync

Extensão Chrome (Manifest V3) para **Google Meet** que captura automaticamente as
**legendas exibidas pelo próprio Meet**, organiza tudo em formato de chat, **avisa quando
te mencionam** e exporta a reunião em `.txt`/`.json` — com correção e resumo/ata opcionais
via um servidor **Ollama** local.

> A extensão **não captura áudio** nem grava tela: apenas lê o texto das legendas que o Meet
> já exibe. Os dados ficam **no seu navegador** e só vão ao Ollama que **você** configurar.

Em publicação na **Chrome Web Store**. Política de privacidade:
<https://daraujo85.github.io/meetsync/privacy.html>.

---

## Recursos

### Captura
- Liga as legendas do Meet **automaticamente** e captura a transcrição enquanto estiverem ligadas (pausa/retoma com elas).
- Histórico em **chat**: nome, horário e avatar colorido por participante; as mensagens do **chat de texto** do Meet entram **intercaladas em ordem cronológica** (com selo "chat") e **links viram clicáveis**.
- **Indicador de captura**: ponto **vermelho REC** pulsante (capturando) / **terracota** (pausado).

### Alertas de menção
- Avisa quando **outra pessoa** fala algo que te interessa — ideal pra quando você está em outra aba.
- **Regras nomeadas**, por **palavra/frase** (sem distinção de acento/maiúscula) ou por **contexto via IA** (Ollama entende o sentido, não só a palavra exata).
- Como avisa: **banner in-app** (aparece mesmo com o painel recolhido), **notificação clicável do Chrome** (traz a aba do Meet pra frente), **som** e **sininho** na barra com contador de não-lidos.
- Ignora as suas próprias falas; botão **"Simular detecção"** para testar.

### Histórico de reuniões
- **Biblioteca local** de todas as reuniões transcritas (ícone de relógio no header do painel).
- Lista com **busca** e cards (data, duração, participantes, prévia da 1ª fala, nº de linhas, com/sem ata); **detalhe** com métricas, prévia transcrição/resumo e ações (baixar `.txt`/ata, favoritar, excluir).
- Acessível também pelo **ícone da toolbar** — dentro ou fora do Meet.

### Não perder a reunião
- **Auto-salva** a transcrição localmente durante e ao encerrar a reunião (até 40 no histórico).
- **Recuperação pelo ícone da toolbar**: se o Meet redirecionar/fechar a aba, o popup mostra **"Última reunião salva → Baixar .txt"** (com IA quando configurada).
- Bloqueia a navegação enquanto o **download com IA** ainda processa (o "voltar à tela inicial" do Meet não interrompe mais o download).
- Re-renders/quedas transientes do Meet **não zeram** mais a transcrição.

### Exportação e IA
- Exporta **`.txt`** (cabeçalho opcional, cronológico) e **`.json`** estruturado para agentes/automações.
- **Ollama** (opt-in, local): **correção** da transcrição e **resumo/ata**, inclusive **em tempo real** via streaming (intervalo configurável 1/2/5/10 min).
- **Vocabulário do negócio**: tags com nomes/produtos/siglas (ex.: Acme, Globex) injetadas nos prompts para corrigir palavras mal-transcritas pelo Google ("acme corp" → "Acme").
- **Seu nome**: substitui "Você" pelo seu nome real na transcrição, exportações e resumos.

### Interface
- Identidade própria (logo + wordmark Meet**Sync**) em **Dark Mode**.
- Barra compacta + painel expandido, ambos **arrastáveis** (posição lembrada).
- Painel com **5 abas**: Transcrição · Alertas · Resumo · Exportar · Upload (beta).
- **Ação do ícone na toolbar**: popup contextual (status da captura no Meet / orientação fora) e página de **boas-vindas** na primeira instalação.

---

## Desenvolvimento

Requisitos: Node 18+.

```bash
npm install
npm run dev      # build de desenvolvimento com HMR (gera dist/)
npm run build    # type-check (tsc --noEmit) + build de produção em dist/
npm run zip      # empacota dist/ em meetsync-<versão>.zip
npm run package  # build + zip
```

Não há suíte de testes — `npm run build` é o gate (precisa passar `tsc --noEmit` estrito).

> **Ícones**: gerados a partir de SVG via Chromium headless (nítidos no tamanho exato). **Não**
> use `scripts/gen-icons.mjs` (gerador placeholder) nem `qlmanage`.

---

## Instalação manual (modo desenvolvedor)

1. Rode `npm install && npm run build` (gera a pasta `dist/`).
2. Abra `chrome://extensions` no Google Chrome.
3. Ative **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta `dist/`.
5. Abra uma reunião em `https://meet.google.com/...`. A barra do MeetSync aparece à direita.

---

## Uso

- Ao entrar na reunião, o MeetSync tenta **ligar as legendas** automaticamente e começa a capturar.
- Use o botão **CC** da barra para ligar/desligar as legendas (pausa/retoma a captura).
- Clique no **ícone do MeetSync na toolbar** a qualquer momento para abrir/recolher o painel ou recuperar a última reunião.
- Na aba **Alertas**, ligue "Monitorar a reunião" e cadastre nomes/palavras (ou descrições para a IA) que devem te avisar.
- Ao final, na aba **Exportar**, baixe o `.txt` (com ou sem IA) e o `.json`.

---

## Ollama (correção, resumo e alertas por contexto)

1. Instale e rode o [Ollama](https://ollama.com) localmente (padrão `http://localhost:11434`).
2. No painel → aba **Exportar** → seção **Ollama**, informe a URL e clique em **Testar**.
3. Escolha um modelo; isso habilita **Corrigir com IA**, **Incluir resumo/ata** e a **detecção de alertas por contexto**.

### CORS / acesso do navegador ao Ollama

As chamadas ao Ollama são feitas pelo *service worker* da extensão, que já tem permissão para
`localhost`/`127.0.0.1`. Se o Ollama recusar por origem, rode-o permitindo a origem da extensão:

```bash
OLLAMA_ORIGINS="chrome-extension://*" ollama serve
```

---

## Limitações conhecidas

- Depende das **legendas do Google Meet**: a qualidade da transcrição é a qualidade das legendas.
- O DOM do Meet muda sem aviso. A lógica de captura está isolada em
  `src/content/caption-capture.ts` e `src/content/chat-capture.ts` (objeto `SELECTORS`).
- Identificação de participantes/avatares é *best-effort*; quando falha, usa iniciais.
- A ativação automática de legendas pode falhar conforme idioma/layout — use o botão CC manual.
- Validado no **Google Chrome desktop** + **Google Meet web**.

---

## Estrutura

Veja `PRD.md` (produto) e `CLAUDE.md` (guia de arquitetura). Código:

```
src/
  background/   service worker (ponte Ollama, notificações, alertas)
  content/      detector de reunião, captura de legendas/chat, monitor de
                alertas (alert-watcher), persistência, bootstrap
  ui/           painel (compacto/expandido), estilos, ícones, logo
  popup/        popup da ação do ícone na toolbar
  welcome/      página de boas-vindas (1ª instalação)
  services/     store, storage (settings + última reunião), export TXT/JSON, Ollama, resumo
  types/        modelo de dados
```
