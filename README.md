# MeetSync

Extensão Chrome (Manifest V3) para **Google Meet** que captura automaticamente as
**legendas exibidas pelo próprio Meet**, organiza tudo em formato de chat e exporta a
reunião em `.txt` — com correção e resumo/ata opcionais via um servidor **Ollama** local.

> Uso interno (DevSync). Instalação manual em modo desenvolvedor, sem Chrome Web Store.
> A extensão **não captura áudio** nem grava tela: apenas lê o texto das legendas do Meet.

---

## Recursos

- **Identidade própria**: logo MeetSync (balão + câmera) e wordmark Meet**Sync**, em **Dark Mode** "nativo" do Meet.
- Barra compacta discreta + painel expandido. Ambos podem ser **arrastados** (pegue pela marca ou pelo header) — a posição é lembrada.
- Ativa as legendas do Meet automaticamente e captura a transcrição enquanto estiverem ligadas; pausa/retoma com as legendas.
- **Indicador de captura**: ponto **vermelho REC** pulsante (capturando) / **terracota** (pausado).
- Histórico em **chat**: nome, horário, avatar colorido por participante; mensagens do **chat de texto** do Meet entram intercaladas (com selo "chat"), e **links viram clicáveis** (abrem em nova aba).
- Painel com **4 abas**: Transcrição · Resumo · Exportar · Upload (beta).
- **Resumo em tempo real** via streaming do Ollama: intervalo configurável (1/2/5/10 min), com shimmer, digitação ao vivo e contagem regressiva.
- Exportação `.txt` (cabeçalho opcional), correção/ata via Ollama (opt-in) e **`.json` estruturado** para agentes de IA / automações.
- Dados ficam **locais**; só são enviados ao Ollama que **você** configurar.

---

## Desenvolvimento

Requisitos: Node 18+.

```bash
npm install
npm run dev      # build de desenvolvimento com HMR (gera dist/)
npm run build    # type-check + build de produção em dist/
npm run zip      # empacota dist/ em meetsync-<versão>.zip
npm run package  # build + zip
```

Ícones placeholder podem ser regerados com `node scripts/gen-icons.mjs`.

---

## Instalação manual (modo desenvolvedor)

1. Rode `npm install && npm run build` (gera a pasta `dist/`).
2. Abra `chrome://extensions` no Google Chrome.
3. Ative **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta `dist/`.
   - Alternativa: `npm run zip` e arraste o `.zip` — ou descompacte e carregue a pasta.
5. Abra uma reunião em `https://meet.google.com/...`. A barra do MeetSync aparece à direita.

---

## Uso

- Ao entrar na reunião, o MeetSync tenta **ligar as legendas** automaticamente.
- O ponto azul "Captura ativa" indica que as legendas estão sendo capturadas.
- Use o botão **CC** da barra para ligar/desligar as legendas (pausa/retoma a captura).
- Clique em **expandir** para ver o chat, configurar exportação e baixar o `.txt`.

---

## Ollama (correção e resumo)

1. Instale e rode o [Ollama](https://ollama.com) localmente (padrão `http://localhost:11434`).
2. No painel do MeetSync → seção **Ollama**, informe a URL e clique em **Testar e listar modelos**.
3. Escolha um modelo; isso habilita os toggles **Corrigir com IA** e **Incluir resumo/ata**.

### CORS / acesso do navegador ao Ollama

As chamadas ao Ollama são feitas pelo *service worker* da extensão, que já tem permissão para
`localhost`/`127.0.0.1`. Se o Ollama recusar a conexão por origem, rode-o permitindo a origem
da extensão:

```bash
OLLAMA_ORIGINS="chrome-extension://*" ollama serve
```

Para um **servidor Ollama remoto** (outra URL), o Chrome pedirá permissão de host na primeira
chamada. Conceda quando solicitado.

---

## Limitações conhecidas

- Depende das **legendas do Google Meet**: a qualidade da transcrição é a qualidade das legendas.
- O DOM do Meet muda sem aviso. Toda a lógica de captura está isolada em
  `src/content/caption-capture.ts` (objeto `SELECTORS`) para ajuste rápido.
- Identificação de participantes/avatares é *best-effort*; quando falha, usa iniciais.
- A ativação automática de legendas pode falhar conforme idioma/layout — use o botão CC manual.
- MVP validado no **Google Chrome desktop** + **Google Meet web**.

---

## Estrutura

Veja `PRD.md` para o documento de produto completo. Código organizado em:

```
src/
  background/   service worker (ponte Ollama)
  content/      detector, captura de legendas, participantes, bootstrap
  ui/           painel (compacto/expandido), estilos, ícones
  services/     store, storage, export TXT, Ollama, resumo
  types/        modelo de dados
```
