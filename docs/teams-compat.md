# Frente de investigação — Compatibilidade com Microsoft Teams (Web)

**Status:** investigação (nenhum código de produção alterado ainda)
**Objetivo:** avaliar a viabilidade de o MeetSync capturar legendas + chat também em reuniões do
**Microsoft Teams no navegador** (`teams.microsoft.com`), mantendo o Google Meet como está.

---

## 1. Como o MeetSync está acoplado ao Google Meet hoje

O núcleo de captura já é isolado (bom para portar). Pontos de acoplamento, por arquivo:

| Camada | Arquivo | Acoplamento ao Meet |
| --- | --- | --- |
| Manifest | `manifest.config.ts` | `content_scripts.matches` e `host_permissions` = `https://meet.google.com/*` |
| Detecção | `src/content/meet-detector.ts` | `SELECTORS.leaveButton`, regex de código `xxx-xxxx-xxx`, parse de URL/`document.title` (`meet.google.com`, `- Google Meet`) |
| Legendas | `src/content/caption-capture.ts` | `SELECTORS` (`jsname="RrG0hf"`, `role="region"` "Legenda/Caption", `jscontroller`), linha do falante achada estruturalmente |
| Chat | `src/content/chat-capture.ts` | `SELECTORS` (`jsname="xySENc"`, `data-message-id`, badge de não lida) |
| Bootstrap | `src/content/content-script.ts` | instancia `MeetDetector` + `CaptionCapture` + `ChatCapture` diretamente |

**Agnóstico de plataforma (não precisa mexer):** `store.ts`, `storage-service.ts`, `export-txt.ts`,
`summary-service.ts`, `ollama-client.ts`, `alert-watcher.ts` e toda a UI (`panel.ts`). Eles operam
sobre `MeetingSession`/`TranscriptEntry`, sem saber de onde veio a captura.

**Conclusão:** o acoplamento está concentrado em 4 arquivos (+ manifest). O resto é reutilizável.

---

## 2. Arquitetura proposta — "Platform Adapter"

Extrair uma interface e ter um adaptador por plataforma, escolhido pelo hostname:

```
src/content/
  platform/
    types.ts          # interface PlatformAdapter { detector, captionCapture, chatCapture, meta }
    detect.ts         # escolhe o adapter pelo location.host
    meet/             # move o código atual pra cá (Meet)
    teams/            # novo adapter (Teams)
  content-script.ts   # usa o adapter resolvido, sem if espalhado
```

Interface mínima (o que cada plataforma precisa fornecer):
- **Detector:** `isInMeeting()`, `onJoined/onLeft`, `getMeetingMeta()` (code/url/title).
- **CaptionCapture:** ligar legendas automaticamente + observar o container e emitir `{name, text, ts}`.
- **ChatCapture:** abrir/observar o painel de chat e emitir mensagens por id.

Como as saídas já são `TranscriptEntry`, a store/UI/export não mudam. O trabalho real é escrever os
`SELECTORS` e a lógica de dedup do Teams.

---

## 3. O que sabemos / suspeitamos do Teams Web (a validar ao vivo)

- **Domínio (CONFIRMADO):** o Teams novo serve a reunião em **`teams.cloud.microsoft`** (migração de
  `*.microsoft.com` para `*.cloud.microsoft`). O manifest precisa casar esse host (provavelmente também
  `teams.microsoft.com` por compatibilidade). Confirmar se há iframe interno de outra origem.
- **Legendas ao vivo (CONFIRMADO no DOM):** ligando "Ativar legendas ao vivo", cada linha aparece no
  DOM com **avatar + nome do autor (negrito) + texto** — exatamente o modelo do Meet. Falta só o
  `outerHTML` do container e da linha pra escrever os seletores (`data-tid`/classe).
- **⚠️ Idioma da legenda (novo requisito de UX):** no Teams o **idioma falado** da legenda é escolhido
  pelo usuário (barra de legenda → ⚙️ → **Configurações de idioma**). Se ficar em inglês com fala em
  português, a transcrição vira ruído. A extensão **não seta isso de forma confiável** (é um diálogo de
  config) → o MeetSync deve **orientar o usuário** (aviso/hint) a ajustar o idioma no Teams. Diferença
  em relação ao Meet, onde só ligamos as legendas.
- **Botão sair (CONFIRMADO):** rótulo "Sair" (UI em pt-BR) / "Leave" — serve de sinal de "em reunião".
- **Ponto a FAVOR — `data-tid`:** o Teams usa atributos `data-tid="..."` estáveis em muitos
  elementos (mais estável que o `jsname`/`jscontroller` ofuscado do Meet). Isso tende a deixar os
  seletores do Teams **mais robustos** que os do Meet.
- **Chat da reunião:** painel lateral; mensagens com `data-tid` e autor/horário.
- **⚠️ iframe:** parte da UI de reunião do Teams pode rodar dentro de `<iframe>`. Se for o caso, o
  content script precisa de `all_frames: true` e/ou casar o host do iframe — **risco técnico #1**.
- **⚠️ Navegador:** a Microsoft empurra o app desktop e às vezes limita o Teams web a Edge/Chrome.
  O alvo é o **Teams no Chrome** (mesma engine da extensão). Reuniões via app desktop (Electron)
  **estão fora de escopo** (extensão de navegador não alcança).

---

## 4. Incógnitas que exigem inspeção AO VIVO (bloqueiam a estimativa)

Só dá pra fechar viabilidade abrindo uma reunião real do Teams no Chrome e inspecionando o DOM:

1. Legendas ao vivo aparecem no DOM? Qual o seletor do container e da linha (autor + texto)?
2. A reunião roda em iframe? Qual a origem?
3. Seletor/estado do botão de legendas (pra ligar automaticamente, como no Meet).
4. Estrutura do chat (container, item, id, autor, horário).
5. Sinais de "entrou/saiu" (equivalente ao botão "Sair da chamada").
6. Como extrair código/título/URL da reunião pra metadados.

**Como coletar:** Diego abre uma reunião de teste no Teams web (Chrome) e captura o HTML das
legendas/chat (ou rodamos uma sessão Playwright logada). Sem isso, não dá pra escrever os `SELECTORS`.

---

## 5. Plano de investigação (fases)

- **F0 — Recon (bloqueante):** abrir reunião real, ligar legendas, coletar DOM de legenda + chat +
  detecção. Responder as 6 incógnitas da seção 4.
- **F1 — Spike técnico:** content script mínimo em `teams.microsoft.com` que só loga no console o
  texto das legendas capturadas (valida DOM + iframe + host perms), sem tocar na store.
- **F2 — Refactor de arquitetura:** extrair `PlatformAdapter`, mover o Meet atual pra `platform/meet/`
  sem mudar comportamento (regressão zero no Meet).
- **F3 — Adapter do Teams:** implementar `platform/teams/` (detector + legendas + chat) e o
  auto-enable de legendas.
- **F4 — Manifest + store:** adicionar host/`matches` do Teams; reescrever justificativas de
  permissão (o host novo dispara revisão detalhada na Web Store, como o `localhost`).

---

## 6. Riscos

- **iframe / all_frames:** pode exigir mudança de manifest e complicar o mount da UI (Shadow DOM).
- **Volatilidade do DOM:** Teams muda com frequência; `data-tid` ajuda, mas exige manutenção (mesmo
  contrato de "editar só no `SELECTORS`" do Meet).
- **Legendas dependem de ativação:** se o tenant/reunião não permitir legendas ao vivo, não há o que
  capturar (mesma limitação do Meet).
- **Review da Web Store:** novo host amplo (`teams.microsoft.com`) aumenta escrutínio; manter
  justificativa clara de "single purpose".
- **App desktop:** grande parte do uso corporativo é no app nativo — fora do alcance. Comunicar isso.

---

## 7. Recomendação

Viável e de baixo risco arquitetural (o núcleo já é agnóstico). O gargalo era **F0 (recon do DOM ao
vivo)** — **feito** (ver seção 8). Falta só o DOM do chat (cliente autenticado). Próximo: spike F1.

---

## 8. Resultado do recon (F0) — feito em 09/07/2026 via CDP numa reunião real

Recon feito entrando na reunião (convidado anônimo) e inspecionando o DOM ao vivo.

### Hosts (2 experiências web distintas!)
- **Autenticado (Teams completo):** `teams.cloud.microsoft` — é o caso real de quem usa a extensão.
- **Convidado anônimo (light meetings):** `teams.microsoft.com/light-meetings/launch` (+ launcher
  `teams.microsoft.com/dl/launcher/...` e `/_#/meet/...`).
- **Manifest precisa casar os dois:** `https://teams.cloud.microsoft/*` **e** `https://teams.microsoft.com/*`.
- **Sem iframe** (`document.querySelectorAll('iframe').length === 0` dentro da reunião) — ótimo, não
  precisa de `all_frames`.

### Mapa de paridade — mesmo recurso, gancho por plataforma

| Recurso | Google Meet (atual) | Microsoft Teams (confirmado) |
| --- | --- | --- |
| "Em reunião" / sair | botão aria "Sair da chamada/Leave" | **`#hangup-button`** (texto "Sair") |
| Ligar legendas | `button[jsname="RrG0hf"]` | `#callingButtons-showMoreBtn` (menu **Mais**) → item `[aria-label="Legendas"]` |
| Desligar/estado legenda | — | `[data-tid="closed-captions-turn-off-button"]`, `#captions-panel-dismiss-button` |
| Container das legendas | `region[aria-label*="Legenda"]` | **`[data-tid="closed-caption-v2-virtual-list-content"]`** (lista **virtualizada**) |
| Linha de legenda | linha estrutural c/ avatar | **`.fui-ChatMessageCompact`** |
| Autor da fala | estrutural | **`[data-tid="author"]`** (nome real) |
| Texto da fala | nó de texto limpo | **`[data-tid="closed-caption-text"]`** |
| Participantes | derivado das falas | `#roster-button` → `[data-tid="calling-roster-attendees"]` → **`[data-tid^="attendeesInMeeting-"]`** (nome no próprio tid) |
| Mão levantada | (não existe hoje) | `[data-tid^="attendeesInMeeting-"]` com `aria-label` contendo **"levantada à mão"** (+ nº de posição) |
| Reações (emojis) | (não existe hoje) | nó efêmero **`[data-tid="participant-reaction"]`** (+ `[data-tid="emoji-placeholder"]`). Detecta que houve reação; **quem/qual emoji** exige mais (emoji via CSS) |
| Chat da reunião | `jsname="xySENc"` / `data-message-id` | lista `[data-tid="message-pane-list-runway"]`; item `[data-tid="chat-pane-item"]`; msg **`[data-tid="chat-pane-message"]`** com **`data-mid`** (dedup); autor `[data-tid="message-author-name"]`; hora `time[datetime]`; texto `#content-<mid>`. **(só no cliente autenticado — anônimo não tem chat)** |
| Nome próprio ("Você") | Meet mostra "Você" → mapear p/ selfName | Teams mostra **o nome real** na legenda → **não precisa** mapear "Me/Você" (mais simples) |
| Código/URL/título | path `xxx-xxxx-xxx`, title "- Google Meet" | URL `/meet/<id>` (auth) ou launch URL c/ `coords` base64 (anon); `document.title` é genérico "Microsoft Teams" → título da reunião **não** sai do title |

### Observações que viram requisito do adapter Teams
1. **Legenda é lista virtualizada:** linhas antigas **saem do DOM** ao rolar. A captura tem que
   observar (MutationObserver) e persistir cada fala **assim que aparece/finaliza** — não dá pra ler
   o container inteiro no fim. Cada linha tem `author` + `closed-caption-text` que atualizam in-place
   (interim → final).
2. **Idioma da legenda é da REUNIÃO inteira** e escolhido pelo usuário (barra ⚙️ → Configurações de
   idioma → "Idioma falado nessa reunião"). Se estiver errado, a transcrição vira ruído. A extensão
   **não seta isso** → precisa **orientar o usuário** (aviso na UI). Muda para todos os participantes.
3. **Ligar legendas é via menu "Mais"** (2 cliques: abrir menu → "Legendas"), diferente do Meet
   (1 botão direto). O auto-enable do adapter precisa abrir o menu antes.
4. **Sem "Você":** o autor vem com nome real, então `selfName` no Teams é só cosmético (Meet usa p/
   trocar "Você"). Detectar "fala do próprio usuário" (usado no alert-watcher) exige comparar pelo
   nome do próprio participante.
5. **PARIDADE — auto-ligar legendas (igual ao Meet):** hoje no Meet a extensão liga as legendas
   sozinha ao entrar. O adapter do Teams **deve fazer o mesmo** (abrir menu "Mais" → "Legendas"), pra
   o usuário não precisar ligar manualmente.
6. **PARIDADE — aviso de idioma:** o padrão do Teams costuma vir em **inglês** e, com fala em PT,
   quebra a transcrição. A maioria das reuniões aqui é em português → a extensão deve **avisar/orientar
   o usuário a conferir o idioma falado** da legenda antes (barra ⚙️ → Configurações de idioma). Como é
   config da reunião e muda p/ todos, a extensão orienta mas não altera sozinha.

### F0 — COMPLETO ✅
Todas as features mapeadas ao vivo (legenda, chat, participantes, mão levantada, reação, detecção,
auto-enable, idioma, hosts, sem iframe). Nada mais pendente de recon.

---

## 9. Implementado (jul/2026)

Compatibilidade base entregue — o Teams funciona com as mesmas features do Meet:
- **Arquitetura `PlatformAdapter`** (`src/content/platform/`): `getPlatform()` escolhe por host;
  `MeetAdapter` embrulha os módulos do Meet (regressão zero); `TeamsAdapter` novo.
- **Teams:** detector (`#hangup-button` + meta da URL), captura de legenda (lista virtual, autor/texto
  por `data-tid`, auto-liga via menu "Mais"→"Legendas"), captura de chat (dedup por `data-mid`).
- **Paridade de dados:** tudo alimenta a mesma store → export `.txt`/`.json`, resumo, correção, Q&A e
  alertas funcionam idênticos. Tag de chat via `isChatSource()` (agnóstica); `source` do JSON = provider.
- **Histórico diferencia o provedor** com ícone (`provMeet`/`provTeams`) no card e no detalhe.
- **Auto-ligar legenda** no Teams (igual Meet) + **aviso de idioma** (notificação ao entrar).
- **Manifest:** hosts `teams.cloud.microsoft` e `teams.microsoft.com`.

## 10. Implementado (2ª leva)
- **Participantes por roster:** registra todos do painel "Pessoas" (inclui quem não falou), não só falantes.
- **Mão levantada** e **reações**: viram eventos na transcrição (`source: microsoft-teams-event`).
- **Badge de provedor colorido** no histórico: Meet verde, Teams roxo.
- **Descrição da extensão** (`_locales`) e **popup** reconhecem Meet + Teams.

## 11. Backlog
- **Emojis de reação não detectados 100%:** alguns emojis do Teams não são resolvidos (glifo não
  vem no DOM e o nome não bate no mapa). Ampliar `REACTION_NAME_MAP`/extração em `teams-events-capture.ts`.
- **Mapear reação/mão-levantada também no Google Meet** (paridade; Meet hoje não tem esses eventos).
- **Atribuição fina da reação** (quem/qual emoji) — hoje best-effort; `emoji-placeholder` renderiza via CSS.
- **Roster/mão-levantada dependem do painel "Pessoas" aberto** — avaliar auto-abrir ou fonte alternativa.
- **Auto-abrir o chat** no Teams em mensagem nova (hoje captura só com o painel aberto).
- **Texto da store:** atualizar `STORE_LISTING.md` p/ mencionar Teams antes de publicar (0.4.3).
- **Código/título** da reunião no Teams autenticado (URL `/v2/` nem sempre traz `/meet/<id>`).
