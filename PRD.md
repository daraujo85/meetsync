# PRD — MeetSync

**Produto:** MeetSync  
**Tipo:** Extensão Chrome para Google Meet  
**Versão:** MVP v0.1  
**Uso previsto:** Interno, via instalação manual em modo desenvolvedor  
**Empresa/autor:** DevSync  
**Foco visual:** Google Meet em Dark Mode  

---

## 1. Visão geral

O **MeetSync** é uma extensão Chrome para Google Meet que captura automaticamente as legendas/transcrições exibidas pelo próprio Meet, organiza o conteúdo em formato de conversa e permite exportar a reunião em `.txt`, com cabeçalho, participantes, horários, transcrição e, opcionalmente, correção/resumo usando um servidor Ollama configurado pelo usuário.

O objetivo principal do MVP é permitir que alguém que se ausentou da reunião por alguns minutos consiga “voltar no tempo” e entender rapidamente **quem falou, o que falou e quando falou**, sem depender de ferramentas pagas, gravação de áudio ou publicação na Chrome Web Store.

A solução deve parecer nativa do Google Meet, com interface discreta, compacta quando fechada e expandida apenas quando o usuário desejar consultar a conversa, configurar exportação ou baixar a transcrição.

---

## 2. Nome do projeto

### Nome escolhido: MeetSync

**Justificativa:**

- Faz alusão direta ao Google Meet.
- Conecta com a identidade da DevSync.
- Passa a ideia de sincronização da conversa, histórico e ata da reunião.
- É curto, memorável e adequado para uso interno/profissional.

Possíveis variações futuras:

- MeetSync Notes
- MeetSync Capture
- DevSync Meet Notes

---

## 3. Objetivos do MVP

### Objetivos principais

1. Injetar uma interface discreta dentro da página de reunião do Google Meet.
2. Ativar automaticamente as legendas do Meet ao entrar na reunião.
3. Capturar a transcrição exibida pelo Meet enquanto as legendas estiverem ativas.
4. Permitir que o usuário desligue manualmente as legendas do Meet para pausar a captura.
5. Retomar a captura quando as legendas forem ativadas novamente.
6. Exibir o histórico da conversa em formato de chat quando o painel estiver expandido.
7. Exportar a transcrição em arquivo `.txt`.
8. Incluir cabeçalho opcional com dados da reunião.
9. Corrigir opcionalmente a transcrição usando Ollama.
10. Gerar opcionalmente um resumo/ata da reunião usando Ollama.
11. Distribuir o projeto por `.zip` para carregamento manual no Chrome em modo desenvolvedor.

### Fora do escopo do MVP

- Publicação na Chrome Web Store.
- Autenticação de usuários.
- Backend próprio obrigatório.
- Armazenamento em nuvem.
- Captura direta de áudio.
- Gravação de tela.
- Transcrição própria por speech-to-text.
- Integração com Google Calendar.
- Integração com Jira, Slack, Teams ou e-mail.
- Multi-browser oficial além do Chrome.
- SRT/VTT como formato obrigatório.

---

## 4. Personas e cenários de uso

### Persona 1 — Participante que saiu por alguns minutos

Como participante de uma reunião, quero abrir o painel expandido e ver o que foi falado enquanto estive ausente, para conseguir voltar ao contexto rapidamente.

### Persona 2 — Líder técnico ou PO

Como líder de reunião, quero baixar a transcrição com participantes, link, data e horários, para consultar decisões e encaminhamentos depois.

### Persona 3 — Usuário com Ollama local ou servidor interno

Como usuário técnico, quero configurar uma URL do Ollama e escolher o modelo disponível, para corrigir a transcrição e gerar uma ata sem enviar dados para provedores externos.

---

## 5. Fluxo principal do MVP

1. Usuário instala a extensão manualmente no Chrome em modo desenvolvedor.
2. Usuário entra em uma reunião do Google Meet.
3. A extensão detecta a página de reunião.
4. A extensão injeta a barra compacta lateral do MeetSync.
5. A extensão tenta ativar automaticamente as legendas do Google Meet.
6. Enquanto as legendas estiverem ativas, o MeetSync captura os textos exibidos.
7. A barra compacta mostra estado de captura, botão de legendas e botão de download.
8. O usuário pode expandir o painel.
9. No painel expandido, o usuário visualiza a transcrição como chat.
10. O usuário pode configurar opções de exportação.
11. O usuário pode baixar a transcrição crua ou processada por IA.
12. Se resumo/ata estiver habilitado e Ollama configurado, o sistema gera arquivo adicional ou inclui resumo no arquivo principal, conforme configuração.

---

## 6. Requisitos funcionais

### 6.1 Instalação e distribuição

| ID | Requisito | Prioridade |
|---|---|---|
| RF-001 | A extensão deve ser compatível com Chrome Extension Manifest V3. | Obrigatório |
| RF-002 | O projeto deve poder ser empacotado em `.zip`. | Obrigatório |
| RF-003 | A extensão deve poder ser carregada manualmente via `chrome://extensions` com modo desenvolvedor ativado. | Obrigatório |
| RF-004 | O MVP não deve depender de publicação na Chrome Web Store. | Obrigatório |
| RF-005 | O pacote deve conter instruções simples de instalação interna. | Obrigatório |

### 6.2 Detecção do Google Meet

| ID | Requisito | Prioridade |
|---|---|---|
| RF-006 | A extensão deve atuar somente em URLs compatíveis com `https://meet.google.com/*`. | Obrigatório |
| RF-007 | A extensão deve detectar quando o usuário entrou efetivamente na reunião. | Obrigatório |
| RF-008 | A extensão não deve exibir o painel na tela inicial antes da reunião, salvo se configurado futuramente. | Desejável |
| RF-009 | A extensão deve reinicializar o estado de captura ao trocar de reunião. | Obrigatório |

### 6.3 Injeção visual na página

| ID | Requisito | Prioridade |
|---|---|---|
| RF-010 | A extensão deve injetar uma barra lateral compacta no lado direito da reunião. | Obrigatório |
| RF-011 | A barra compacta deve ocupar o mínimo possível de largura. | Obrigatório |
| RF-012 | A barra compacta não deve criar um grande espaço vazio lateral na interface. | Obrigatório |
| RF-013 | A interface do Meet deve continuar ocupando o máximo possível da tela quando a extensão estiver recolhida. | Obrigatório |
| RF-014 | O painel expandido deve ocupar mais largura somente quando o usuário solicitar. | Obrigatório |
| RF-015 | O painel expandido deve poder ser recolhido novamente. | Obrigatório |
| RF-016 | A interface deve parecer nativa do Google Meet em Dark Mode. | Obrigatório |
| RF-017 | A extensão deve evitar sobrepor controles críticos do Meet. | Obrigatório |

### 6.4 Modo compacto

| ID | Requisito | Prioridade |
|---|---|---|
| RF-018 | O modo compacto deve exibir o nome/logo MeetSync ou ícone discreto. | Obrigatório |
| RF-019 | O modo compacto deve exibir botão para expandir o painel. | Obrigatório |
| RF-020 | O modo compacto deve exibir atalho para ligar/desligar legendas do Meet. | Obrigatório |
| RF-021 | O modo compacto deve exibir botão de download rápido da transcrição. | Obrigatório |
| RF-022 | O modo compacto deve indicar se a captura está ativa. | Obrigatório |
| RF-023 | O indicador de captura ativa deve usar azul do tema, não verde. | Obrigatório |
| RF-024 | A largura recomendada da barra compacta deve ficar entre 56px e 72px. | Obrigatório |
| RF-025 | O modo compacto deve ser visualmente discreto e não competir com os participantes da reunião. | Obrigatório |

### 6.5 Modo expandido

| ID | Requisito | Prioridade |
|---|---|---|
| RF-026 | O painel expandido deve abrir no lado direito da tela. | Obrigatório |
| RF-027 | O painel expandido deve usar Dark Mode. | Obrigatório |
| RF-028 | O painel expandido deve conter cabeçalho com nome MeetSync, estado Beta e controles. | Obrigatório |
| RF-029 | O painel expandido deve exibir estado das legendas do Meet. | Obrigatório |
| RF-030 | O painel expandido deve exibir estado da captura automática. | Obrigatório |
| RF-031 | O painel expandido deve ter aba ou seção de Transcrição. | Obrigatório |
| RF-032 | O painel expandido deve ter aba ou seção de Resumo quando IA estiver configurada. | Desejável |
| RF-033 | O painel expandido deve exibir opções de exportação. | Obrigatório |
| RF-034 | O painel expandido deve exibir prévia do conteúdo `.txt`. | Desejável |
| RF-035 | O painel expandido deve ter botão para fechar/recolher. | Obrigatório |

### 6.6 Captura das legendas do Google Meet

| ID | Requisito | Prioridade |
|---|---|---|
| RF-036 | A extensão deve tentar ativar automaticamente as legendas do Google Meet ao entrar na reunião. | Obrigatório |
| RF-037 | A extensão deve capturar apenas o texto exibido pelas legendas do Meet. | Obrigatório |
| RF-038 | A extensão não deve capturar áudio diretamente. | Obrigatório |
| RF-039 | A extensão deve pausar a captura quando as legendas forem desligadas. | Obrigatório |
| RF-040 | A extensão deve retomar a captura quando as legendas forem religadas. | Obrigatório |
| RF-041 | A captura deve manter continuidade da transcrição ao religar as legendas. | Obrigatório |
| RF-042 | A extensão deve evitar duplicação de linhas capturadas. | Obrigatório |
| RF-043 | A extensão deve agrupar falas por participante quando possível. | Obrigatório |
| RF-044 | A extensão deve registrar horário local de cada fala capturada. | Obrigatório |
| RF-045 | A extensão deve registrar início e fim do período de captura. | Obrigatório |
| RF-046 | A extensão deve lidar com mudanças dinâmicas do DOM do Meet. | Obrigatório |
| RF-047 | A extensão deve continuar funcionando após pequenas mudanças visuais da reunião, sempre que possível. | Desejável |

### 6.7 Histórico em formato de chat

| ID | Requisito | Prioridade |
|---|---|---|
| RF-048 | A transcrição expandida deve ser exibida como um chat cronológico. | Obrigatório |
| RF-049 | Cada item do chat deve conter nome do participante. | Obrigatório |
| RF-050 | Cada item do chat deve conter horário da fala. | Obrigatório |
| RF-051 | Cada item do chat deve conter texto falado. | Obrigatório |
| RF-052 | Cada item do chat deve usar foto/avatar do Meet quando disponível. | Desejável |
| RF-053 | Quando não houver avatar disponível, deve usar avatar fallback com iniciais. | Desejável |
| RF-054 | O chat deve rolar automaticamente para o final enquanto o usuário estiver no fim da lista. | Desejável |
| RF-055 | Se o usuário rolar para cima, o autoscroll não deve forçar retorno automático. | Desejável |
| RF-056 | O painel deve permitir consultar falas anteriores rapidamente. | Obrigatório |

### 6.8 Metadados da reunião

| ID | Requisito | Prioridade |
|---|---|---|
| RF-057 | A extensão deve capturar o link da reunião. | Obrigatório |
| RF-058 | A extensão deve capturar o código da reunião quando disponível. | Obrigatório |
| RF-059 | A extensão deve capturar o título/tema da reunião quando disponível na interface. | Desejável |
| RF-060 | A extensão deve capturar data da reunião. | Obrigatório |
| RF-061 | A extensão deve capturar horário de início da captura. | Obrigatório |
| RF-062 | A extensão deve capturar horário de término da captura. | Obrigatório |
| RF-063 | A extensão deve capturar lista de participantes identificados durante a reunião. | Obrigatório |
| RF-064 | A lista de participantes deve ser usada no cabeçalho do arquivo exportado. | Obrigatório |

### 6.9 Exportação TXT

| ID | Requisito | Prioridade |
|---|---|---|
| RF-065 | A extensão deve permitir exportar a transcrição em `.txt`. | Obrigatório |
| RF-066 | O arquivo deve poder conter cabeçalho com dados da reunião. | Obrigatório |
| RF-067 | A inclusão do cabeçalho deve ser controlada por toggle. | Obrigatório |
| RF-068 | O toggle de cabeçalho deve vir ativado por padrão. | Obrigatório |
| RF-069 | O arquivo deve conter a transcrição em ordem cronológica. | Obrigatório |
| RF-070 | Cada fala no `.txt` deve conter horário, participante e texto. | Obrigatório |
| RF-071 | O nome do arquivo deve sugerir data, horário e nome/código da reunião. | Obrigatório |
| RF-072 | O usuário deve poder baixar a transcrição crua sem IA. | Obrigatório |
| RF-073 | O SRT/VTT não é obrigatório no MVP. | Obrigatório |

### 6.10 Cabeçalho do TXT

O cabeçalho deve seguir este modelo quando habilitado:

```txt
MEETSYNC — TRANSCRIÇÃO DA REUNIÃO

Reunião: Reunião de Produto - Q2
Link: https://meet.google.com/tdj-xhkn-acv
Código: tdj-xhkn-acv
Data: 11/06/2026
Início da captura: 12:01
Fim da captura: 13:08
Duração da captura: 1h07min
Participantes identificados:
- Diego Araujo
- Juliana Martins
- Lucas Vasconcelos
- Você

------------------------------------------------------------
TRANSCRIÇÃO
------------------------------------------------------------

[12:01] Diego Araujo: Bom dia, pessoal! Vamos começar nossa revisão...
```

### 6.11 Configuração Ollama

| ID | Requisito | Prioridade |
|---|---|---|
| RF-074 | A extensão deve permitir configurar uma URL do Ollama. | Obrigatório |
| RF-075 | A URL padrão sugerida deve ser `http://localhost:11434`. | Obrigatório |
| RF-076 | A extensão deve permitir testar conexão com Ollama. | Desejável |
| RF-077 | A extensão deve listar modelos disponíveis no Ollama. | Obrigatório |
| RF-078 | A listagem de modelos deve usar endpoint compatível com Ollama `/api/tags`. | Obrigatório |
| RF-079 | O usuário deve escolher um modelo antes de habilitar recursos de IA. | Obrigatório |
| RF-080 | As configurações de URL/modelo devem ser persistidas localmente. | Obrigatório |
| RF-081 | Caso Ollama não esteja configurado, opções de IA devem ficar desabilitadas ou com aviso claro. | Obrigatório |

### 6.12 Correção da transcrição com IA

| ID | Requisito | Prioridade |
|---|---|---|
| RF-082 | A extensão deve oferecer toggle para corrigir transcrição com IA. | Obrigatório |
| RF-083 | O toggle de correção com IA deve vir desativado por padrão no primeiro uso. | Recomendado |
| RF-084 | Se ativado, o download deve processar a transcrição antes de gerar o arquivo final. | Obrigatório |
| RF-085 | A correção deve preservar sentido, participantes e horários. | Obrigatório |
| RF-086 | A correção não deve inventar conteúdo não presente na transcrição. | Obrigatório |
| RF-087 | O usuário deve poder baixar a versão crua sem executar IA. | Obrigatório |
| RF-088 | Durante o processamento por IA, a interface deve indicar carregamento. | Obrigatório |
| RF-089 | Se o processamento falhar, a extensão deve oferecer baixar a transcrição crua. | Obrigatório |

### 6.13 Resumo / ata da reunião

| ID | Requisito | Prioridade |
|---|---|---|
| RF-090 | A extensão deve oferecer toggle para incluir resumo/ata. | Obrigatório |
| RF-091 | O resumo/ata deve depender de Ollama configurado e modelo selecionado. | Obrigatório |
| RF-092 | O toggle de resumo/ata deve ficar desabilitado quando Ollama não estiver pronto. | Obrigatório |
| RF-093 | A extensão deve permitir incluir resumo no mesmo arquivo da transcrição. | Desejável |
| RF-094 | A extensão deve permitir gerar arquivo separado apenas com o resumo/ata. | Obrigatório |
| RF-095 | O resumo deve conter principais assuntos discutidos. | Obrigatório |
| RF-096 | O resumo deve conter decisões tomadas quando identificáveis. | Obrigatório |
| RF-097 | O resumo deve conter responsáveis quando identificáveis. | Obrigatório |
| RF-098 | O resumo deve conter próximos passos quando identificáveis. | Obrigatório |
| RF-099 | O resumo não deve inventar responsáveis ou decisões. | Obrigatório |

Modelo esperado de ata:

```txt
MEETSYNC — RESUMO / ATA DA REUNIÃO

Reunião: Reunião de Produto - Q2
Data: 11/06/2026
Link: https://meet.google.com/tdj-xhkn-acv

1. Principais assuntos
- Revisão do roadmap do produto para o Q2.
- Métricas de adoção atualizadas.
- Retenção e evolução do produto.

2. Decisões identificadas
- Validar documento de métricas antes do próximo alinhamento.

3. Responsáveis
- Lucas Vasconcelos: confirmar recebimento e atualização do documento de métricas.

4. Próximos passos
- Compartilhar documento atualizado.
- Revisar números de adoção.
- Retomar discussão sobre retenção.

5. Observações
- Este resumo foi gerado automaticamente a partir da transcrição capturada pelo MeetSync.
```

### 6.14 Toggles e opções de download

| ID | Requisito | Prioridade |
|---|---|---|
| RF-100 | A tela de exportação deve conter toggle “Incluir cabeçalho”. | Obrigatório |
| RF-101 | O toggle “Incluir cabeçalho” deve vir ativado por padrão. | Obrigatório |
| RF-102 | A tela de exportação deve conter toggle “Corrigir com IA”. | Obrigatório |
| RF-103 | A tela de exportação deve conter toggle “Incluir resumo/ata”. | Obrigatório |
| RF-104 | A tela de exportação deve conter toggle “Gerar arquivo separado de resumo”. | Obrigatório |
| RF-105 | Toggles ativos devem usar azul do Meet, não verde. | Obrigatório |
| RF-106 | Toggles inativos devem usar cinza escuro do Meet. | Obrigatório |
| RF-107 | Opções dependentes de IA devem exibir estado indisponível quando Ollama não estiver configurado. | Obrigatório |

### 6.15 Persistência local

| ID | Requisito | Prioridade |
|---|---|---|
| RF-108 | A extensão deve persistir configurações em `chrome.storage.local`. | Obrigatório |
| RF-109 | A extensão deve armazenar temporariamente a transcrição da reunião em memória ou storage local. | Obrigatório |
| RF-110 | A extensão deve limpar ou isolar dados ao iniciar nova reunião. | Obrigatório |
| RF-111 | A extensão não deve enviar dados para serviços externos, exceto Ollama configurado pelo usuário. | Obrigatório |
| RF-112 | O MVP deve priorizar armazenamento local. | Obrigatório |

---

## 7. Requisitos não funcionais

### 7.1 Usabilidade

| ID | Requisito | Prioridade |
|---|---|---|
| RNF-001 | A extensão deve ser simples o suficiente para uso sem treinamento técnico. | Obrigatório |
| RNF-002 | O modo compacto deve permitir uso normal da reunião sem distração. | Obrigatório |
| RNF-003 | O modo expandido deve organizar claramente transcrição, exportação e resumo. | Obrigatório |
| RNF-004 | Os textos da interface devem estar inicialmente em português do Brasil. | Obrigatório |
| RNF-005 | A interface deve comunicar claramente quando está capturando e quando está pausada. | Obrigatório |

### 7.2 Performance

| ID | Requisito | Prioridade |
|---|---|---|
| RNF-006 | A captura não deve causar travamentos perceptíveis na reunião. | Obrigatório |
| RNF-007 | O uso de MutationObserver deve ser otimizado para evitar processamento excessivo. | Obrigatório |
| RNF-008 | O painel deve renderizar listas longas de transcrição com boa performance. | Desejável |
| RNF-009 | A IA deve ser executada apenas sob ação explícita de download/processamento. | Obrigatório |
| RNF-010 | O processamento de IA deve exibir feedback de progresso/carregamento. | Obrigatório |

### 7.3 Privacidade e segurança

| ID | Requisito | Prioridade |
|---|---|---|
| RNF-011 | A extensão não deve capturar áudio bruto. | Obrigatório |
| RNF-012 | A extensão não deve gravar tela. | Obrigatório |
| RNF-013 | A extensão não deve enviar conteúdo para nuvem por padrão. | Obrigatório |
| RNF-014 | O envio ao Ollama deve ocorrer apenas quando o usuário habilitar explicitamente IA. | Obrigatório |
| RNF-015 | A URL do Ollama deve ser visível e editável pelo usuário. | Obrigatório |
| RNF-016 | O usuário deve entender que conteúdo da reunião será enviado para a URL Ollama configurada quando IA estiver ativa. | Obrigatório |
| RNF-017 | As permissões do Chrome devem ser mínimas. | Obrigatório |
| RNF-018 | A extensão deve solicitar host permission apenas para `meet.google.com` e URL Ollama configurada quando necessário. | Desejável |

### 7.4 Compatibilidade

| ID | Requisito | Prioridade |
|---|---|---|
| RNF-019 | O MVP deve ser validado no Google Chrome desktop. | Obrigatório |
| RNF-020 | O MVP deve focar em Google Meet web. | Obrigatório |
| RNF-021 | O MVP deve considerar que o DOM do Google Meet pode mudar. | Obrigatório |
| RNF-022 | O código de captura deve ser modular para facilitar ajustes futuros no seletor de legendas. | Obrigatório |

### 7.5 Manutenibilidade

| ID | Requisito | Prioridade |
|---|---|---|
| RNF-023 | O código deve separar captura, estado, UI, exportação e integração Ollama. | Obrigatório |
| RNF-024 | O projeto deve possuir README com instalação, uso e limitações. | Obrigatório |
| RNF-025 | O projeto deve possuir estrutura clara para evolução futura. | Obrigatório |
| RNF-026 | A extensão deve ser desenvolvida com padrões simples para manutenção interna. | Obrigatório |

### 7.6 Acessibilidade visual

| ID | Requisito | Prioridade |
|---|---|---|
| RNF-027 | A interface deve ter contraste adequado em Dark Mode. | Obrigatório |
| RNF-028 | Ícones devem ter tooltip textual. | Desejável |
| RNF-029 | Estados de toggle não devem depender apenas de cor; devem ter texto/label. | Obrigatório |
| RNF-030 | Áreas clicáveis devem ter tamanho mínimo confortável. | Obrigatório |

---

## 8. Design System — MeetSync Dark Mode

### 8.1 Direção visual

O MeetSync deve parecer uma extensão nativa do Google Meet, evitando identidade visual muito própria ou elementos chamativos. A interface deve ser discreta, moderna, com cantos arredondados, superfícies escuras, bordas sutis e azul como cor principal de ação.

### 8.2 Princípios visuais

1. **Nativo ao Meet:** usar tons próximos aos do Google Meet em modo escuro.
2. **Discreto:** a extensão deve apoiar a reunião, não competir visualmente com ela.
3. **Compacto por padrão:** recolhida, deve ocupar o mínimo de largura possível.
4. **Expansível sob demanda:** opções avançadas aparecem apenas no painel aberto.
5. **Sem verde:** evitar verde para estados ativos, toggles ou status.
6. **Azul como ação ativa:** usar azul claro do Meet para highlights, toggles ativos e indicadores.
7. **Vermelho somente para alerta/parada:** usar vermelho apenas para estados críticos, erro ou ação destrutiva.

---

## 9. Tokens de design

### 9.1 Cores principais

| Token | Uso | Cor sugerida |
|---|---|---|
| `--ms-bg-app` | Fundo geral/overlay | `#0F0F0F` |
| `--ms-bg-surface` | Painel principal | `#202124` |
| `--ms-bg-surface-elevated` | Cards, inputs, botões secundários | `#2A2B2E` |
| `--ms-bg-surface-hover` | Hover discreto | `#303134` |
| `--ms-border-subtle` | Bordas sutis | `#3C4043` |
| `--ms-border-focus` | Foco/ativo | `#8AB4F8` |
| `--ms-text-primary` | Texto principal | `#E8EAED` |
| `--ms-text-secondary` | Texto secundário | `#BDC1C6` |
| `--ms-text-muted` | Texto auxiliar | `#9AA0A6` |
| `--ms-accent-blue` | Ação principal/ativo | `#8AB4F8` |
| `--ms-accent-blue-strong` | Botão ativo/linha selecionada | `#669DF6` |
| `--ms-accent-blue-soft` | Fundo de destaque azul | `rgba(138, 180, 248, 0.16)` |
| `--ms-danger-red` | Erro/ação destrutiva | `#F28B82` |
| `--ms-danger-red-strong` | Botão de parar/erro forte | `#EA4335` |
| `--ms-warning-yellow` | Aviso discreto | `#FDD663` |
| `--ms-toggle-off` | Toggle desligado | `#5F6368` |
| `--ms-shadow` | Sombra/elevation | `rgba(0, 0, 0, 0.45)` |

### 9.2 Regra importante de cor

A extensão **não deve usar verde** como cor de sucesso, ativo ou captura ligada.  
Estados ativos devem usar azul claro, acompanhados de texto:

- `Captura ativa` → ponto azul + texto.
- `Legendas ativadas` → toggle azul.
- `IA habilitada` → toggle azul.
- `Erro no Ollama` → vermelho.
- `Aguardando legendas` → cinza/azul suave.

### 9.3 Tipografia

| Token | Valor |
|---|---|
| Fonte | `Google Sans`, `Roboto`, `Arial`, sans-serif |
| Tamanho base | `13px` |
| Texto pequeno | `11px` |
| Texto secundário | `12px` |
| Título de painel | `14px` ou `15px` |
| Peso regular | `400` |
| Peso médio | `500` |
| Peso forte | `600` |

### 9.4 Espaçamento

| Token | Valor |
|---|---|
| `--ms-space-1` | `4px` |
| `--ms-space-2` | `8px` |
| `--ms-space-3` | `12px` |
| `--ms-space-4` | `16px` |
| `--ms-space-5` | `20px` |
| `--ms-space-6` | `24px` |

### 9.5 Bordas e cantos

| Token | Valor |
|---|---|
| Raio pequeno | `8px` |
| Raio médio | `12px` |
| Raio grande | `18px` |
| Raio pill | `999px` |
| Borda padrão | `1px solid #3C4043` |

### 9.6 Elevação

| Token | Valor |
|---|---|
| Sombra painel | `0 12px 32px rgba(0,0,0,0.45)` |
| Sombra leve | `0 4px 12px rgba(0,0,0,0.28)` |
| Blur opcional | `backdrop-filter: blur(8px)` |

---

## 10. Componentes visuais

### 10.1 Barra compacta

**Objetivo:** ocupar o mínimo possível sem atrapalhar a reunião.

Especificação:

- Posição: direita, centralizada verticalmente ou alinhada ao centro da área útil.
- Largura: 56px a 72px.
- Altura: variável conforme botões.
- Fundo: `--ms-bg-surface` com leve transparência opcional.
- Borda: `--ms-border-subtle`.
- Raio: `18px`.
- Botões empilhados verticalmente.
- Sem grande área vazia antes/depois.
- Não deve deslocar o conteúdo da reunião por uma largura maior que a barra.
- Conteúdo da reunião deve aproveitar quase toda a tela.

Itens recomendados:

1. Logo/ícone MeetSync.
2. Botão expandir.
3. Botão legendas CC.
4. Botão download TXT.
5. Indicador de captura ativa.

### 10.2 Painel expandido

Especificação:

- Posição: lado direito.
- Largura recomendada: 380px a 460px.
- Altura: entre 80% e 92% da viewport.
- Fundo: `--ms-bg-surface`.
- Texto: `--ms-text-primary`.
- Borda: `--ms-border-subtle`.
- Sombra: `--ms-shadow`.
- Canto: `18px`.
- Dark Mode obrigatório.

Estrutura:

1. Header.
2. Estado de legendas/captura.
3. Tabs: Transcrição / Resumo.
4. Lista de chat.
5. Área de exportação.
6. Configuração Ollama.
7. Prévia do TXT.
8. Rodapé com dica/estado.

### 10.3 Toggle

Estados:

- Off: track `#5F6368`, thumb `#BDC1C6`.
- On: track `rgba(138, 180, 248, 0.38)`, thumb `#8AB4F8`.
- Disabled: opacidade 45%.

Regra:

- Nunca usar verde para toggle ativo.

### 10.4 Botões

#### Botão primário

- Fundo: `--ms-accent-blue-soft`.
- Texto: `--ms-accent-blue`.
- Borda: `1px solid rgba(138,180,248,0.35)`.
- Hover: `rgba(138,180,248,0.24)`.

#### Botão secundário

- Fundo: `--ms-bg-surface-elevated`.
- Texto: `--ms-text-primary`.
- Borda: `--ms-border-subtle`.

#### Botão destrutivo/erro

- Fundo: `rgba(242,139,130,0.16)`.
- Texto: `--ms-danger-red`.
- Uso limitado para falhas/erro/limpar transcrição.

### 10.5 Chat de transcrição

Cada mensagem deve conter:

- Avatar pequeno.
- Nome do participante.
- Horário.
- Texto da fala.

Layout sugerido:

```txt
[Avatar] Diego Araujo    12:01
         Bom dia, pessoal! Vamos começar nossa revisão...
```

Cores:

- Nome: `--ms-text-primary`.
- Horário: `--ms-text-muted`.
- Texto: `--ms-text-secondary`.
- Separadores: borda sutil ou espaçamento.

### 10.6 Status de captura

Estados possíveis:

| Estado | Visual |
|---|---|
| Captura ativa | Ponto azul + texto “Captura ativa” |
| Legendas desligadas | Ponto cinza + texto “Aguardando legendas” |
| Processando IA | Spinner azul + texto “Processando com Ollama” |
| Erro IA | Ponto vermelho + texto “Erro ao processar IA” |

---

## 11. Arquitetura técnica sugerida

### 11.1 Estrutura de pastas

```txt
meetsync/
├── manifest.json
├── README.md
├── PRD.md
├── package.json
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── content/
│   │   ├── meet-detector.ts
│   │   ├── caption-capture.ts
│   │   ├── participant-resolver.ts
│   │   └── content-script.ts
│   ├── ui/
│   │   ├── components/
│   │   ├── styles/
│   │   │   ├── tokens.css
│   │   │   └── meetsync.css
│   │   └── panel.tsx
│   ├── services/
│   │   ├── export-txt.ts
│   │   ├── ollama-client.ts
│   │   ├── summary-service.ts
│   │   └── storage-service.ts
│   └── types/
│       └── index.ts
└── dist/
```

### 11.2 Módulos principais

| Módulo | Responsabilidade |
|---|---|
| `meet-detector` | Detectar entrada em reunião e mudanças de URL/DOM |
| `caption-capture` | Observar legendas exibidas pelo Meet |
| `participant-resolver` | Identificar nomes/avatares quando possível |
| `panel` | Renderizar UI compacta e expandida |
| `storage-service` | Persistir configurações e sessão |
| `export-txt` | Montar arquivos `.txt` |
| `ollama-client` | Listar modelos e chamar geração |
| `summary-service` | Criar resumo/ata baseado na transcrição |

### 11.3 Permissões mínimas previstas

```json
{
  "permissions": ["storage", "downloads"],
  "host_permissions": ["https://meet.google.com/*"]
}
```

Observação: chamadas para Ollama local podem exigir ajustes de permissões/CORS conforme estratégia técnica adotada.

---

## 12. Modelo de dados

### 12.1 MeetingSession

```ts
type MeetingSession = {
  id: string;
  meetingCode: string;
  meetingUrl: string;
  meetingTitle?: string;
  captureStartedAt: string;
  captureEndedAt?: string;
  participants: Participant[];
  transcript: TranscriptEntry[];
};
```

### 12.2 Participant

```ts
type Participant = {
  id?: string;
  name: string;
  avatarUrl?: string;
};
```

### 12.3 TranscriptEntry

```ts
type TranscriptEntry = {
  id: string;
  participantName: string;
  participantAvatarUrl?: string;
  text: string;
  capturedAt: string;
  source: 'google-meet-caption';
};
```

### 12.4 UserSettings

```ts
type UserSettings = {
  autoEnableCaptions: boolean;
  includeHeaderByDefault: boolean;
  ollamaUrl?: string;
  ollamaModel?: string;
  enableAiCorrection: boolean;
  includeSummary: boolean;
  separateSummaryFile: boolean;
};
```

---

## 13. Critérios de aceite

### MVP aceito quando:

1. A extensão instala manualmente no Chrome via modo desenvolvedor.
2. Ao entrar no Google Meet, a barra compacta aparece automaticamente.
3. A barra compacta ocupa pouco espaço e não deixa grande área vazia lateral.
4. A extensão tenta ativar as legendas automaticamente.
5. Quando as legendas estão ativas, a transcrição é capturada.
6. Quando as legendas são desligadas manualmente, a captura pausa.
7. Quando as legendas são religadas, a captura continua.
8. O painel expandido mostra a conversa em formato de chat.
9. O download `.txt` funciona com transcrição crua.
10. O cabeçalho pode ser incluído ou removido via toggle.
11. O cabeçalho vem ativado por padrão.
12. O usuário consegue configurar URL do Ollama.
13. O usuário consegue listar modelos disponíveis no Ollama.
14. O usuário consegue escolher modelo.
15. A correção por IA só roda se o toggle estiver habilitado.
16. O resumo/ata só roda se Ollama estiver configurado e habilitado.
17. A extensão permite gerar arquivo separado de resumo.
18. A UI está em Dark Mode.
19. Toggles ativos usam azul, não verde.
20. A interface parece visualmente integrada ao Google Meet.

---

## 14. Riscos e pontos de atenção

| Risco | Impacto | Mitigação |
|---|---|---|
| Google Meet mudar o DOM das legendas | Alto | Isolar seletores no módulo `caption-capture` |
| Ativar legendas automaticamente pode falhar | Médio | Exibir estado e permitir botão manual |
| Identificação de participante pode ser incompleta | Médio | Usar fallback por nome textual disponível |
| Duplicação de legenda parcial | Médio | Implementar deduplicação por participante + texto + janela de tempo |
| Ollama indisponível | Baixo | Permitir download cru como fallback |
| CORS no Ollama local | Médio | Documentar configuração ou usar estratégia via extension permissions |
| Uso indevido em reuniões sensíveis | Alto | UI transparente e processamento externo somente opcional |

---

## 15. Roadmap pós-MVP

1. Busca dentro da transcrição.
2. Marcação manual de pontos importantes.
3. Exportação Markdown.
4. Exportação JSON.
5. Melhor suporte a resumo estruturado por tópicos.
6. Integração com Jira para próximos passos.
7. Integração com Google Calendar para título oficial da reunião.
8. Identificação mais robusta de participantes.
9. Configuração de prompts personalizados.
10. Histórico local de reuniões.
11. Modo “não capturar esta reunião”.
12. Empacotamento com auto-build.
13. Página de opções dedicada.

---

## 16. Prompt base para correção da transcrição

```txt
Você receberá uma transcrição capturada automaticamente do Google Meet.
Corrija erros de reconhecimento, pontuação e quebras de frase, preservando fielmente o sentido original.

Regras:
- Não invente informações.
- Não remova falas relevantes.
- Não altere nomes dos participantes.
- Preserve os horários quando existirem.
- Corrija apenas erros claros de transcrição.
- Mantenha o texto em português do Brasil.

Transcrição:
{{TRANSCRIPT}}
```

---

## 17. Prompt base para resumo/ata

```txt
Você receberá a transcrição de uma reunião.
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
- Quando algo não estiver claro, escreva “não identificado na transcrição”.
- Seja direto, profissional e útil.

Dados da reunião:
{{MEETING_METADATA}}

Transcrição:
{{TRANSCRIPT}}
```

---

## 18. Definição de pronto

Uma entrega do MeetSync MVP será considerada pronta quando:

- O projeto buildar sem erro.
- A extensão carregar em modo desenvolvedor.
- A extensão funcionar em uma reunião real do Google Meet.
- O usuário conseguir capturar, visualizar e baixar a transcrição.
- O painel estiver em Dark Mode.
- A interface compacta não atrapalhar a reunião.
- A interface expandida permitir configurar download e IA.
- As cores estiverem alinhadas ao Google Meet, sem uso de verde.
- README e PRD estiverem presentes no pacote.

