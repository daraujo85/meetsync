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

- **Domínios:** novo Teams em `teams.microsoft.com` (SPA React, rota tipo `/v2/` e `/_#/...`).
  Pode haver `teams.live.com` (pessoal). Confirmar os hosts reais das reuniões.
- **Legendas ao vivo:** o Teams tem "Ativar legendas ao vivo" (menu **...** → Idioma e fala). Elas
  **são renderizadas no DOM** (não são só overlay de vídeo) — é o equivalente do que fazemos no Meet.
  Cada linha traz **autor + texto**. Precisamos confirmar o seletor do container e da linha.
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

Viável e de baixo risco arquitetural (o núcleo já é agnóstico). O gargalo é **F0 (recon do DOM ao
vivo)** — sem isso não há estimativa firme. Sugiro: fazer o recon, depois o spike F1; se as legendas
estiverem no DOM e sem iframe problemático, seguir com o refactor F2 e o adapter F3.
