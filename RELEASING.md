# Publicando o MeetSync na Chrome Web Store

A publicação é **semiautomática**: o GitHub Actions sobe o pacote como **rascunho** e
você dá o clique final de "Publicar" no Developer Dashboard. A revisão da Google
continua manual (não há como pular a fila de review).

## Fluxo de uma nova versão

1. Faça os ajustes e bumpe a versão em `package.json` (o manifest sai dela).
2. Atualize o texto da loja em `STORE_LISTING.md` (descrição + seção "Novidades").
3. Commit + push na `master`.
4. Crie e suba a tag:
   ```bash
   git tag -a v0.4.3 -m "MeetSync 0.4.3 — ..."
   git push origin v0.4.3
   ```
5. O workflow `Release to Chrome Web Store` builda, empacota e sobe o zip como **rascunho**.
6. Abra o [Developer Dashboard](https://chrome.google.com/webstore/devconsole), confira
   o rascunho, cole as novidades do `STORE_LISTING.md` e clique em **Publicar**.

> Rodar localmente (sem CI): exporte as 4 variáveis abaixo e rode `npm run package && npm run publish:store`.

## Setup único das credenciais (só o dono da conta consegue fazer)

A automação usa a **Chrome Web Store API**. Você precisa gerar 4 valores e salvá-los
como **secrets** no GitHub (Settings → Secrets and variables → Actions):

| Secret no GitHub      | O que é                                                        |
| --------------------- | -------------------------------------------------------------- |
| `CWS_EXTENSION_ID`    | App ID da extensão (na URL do item no Developer Dashboard).    |
| `CWS_CLIENT_ID`       | Client ID do OAuth 2.0 (Google Cloud).                         |
| `CWS_CLIENT_SECRET`   | Client secret do OAuth 2.0.                                    |
| `CWS_REFRESH_TOKEN`   | Refresh token gerado uma vez com sua conta de desenvolvedor.   |
| `CWS_PUBLISHER_ID`    | Publisher ID da sua conta (Developer Dashboard → Account).     |

### Passo a passo

1. **App ID:** Developer Dashboard → abra o MeetSync → copie o ID da URL
   (`.../devconsole/.../<APP_ID>/`).
2. **Google Cloud:**
   - Crie/escolha um projeto em https://console.cloud.google.com
   - **APIs & Services → Library →** habilite **Chrome Web Store API**.
   - **APIs & Services → OAuth consent screen:** configure (tipo External, adicione seu
     e-mail como usuário de teste).
   - **Credentials → Create credentials → OAuth client ID → tipo "Desktop app".**
     Guarde o **Client ID** e o **Client secret**.
3. **Refresh token** (uma vez): com o Client ID/secret do passo 2, rode o helper do repo
   (faz o fluxo de loopback e imprime o token):
   ```bash
   node scripts/get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>
   ```
   Ele abre o navegador; **autorize com a conta que gerencia o MeetSync na store**. Requer
   a tela de consentimento **publicada (Em produção)** — senão dá `403 access_denied`.
   (Alternativa: `npx chrome-webstore-upload-keys`, que cria um client novo do zero.)
4. Salve os valores como secrets `CWS_*` no GitHub (tabela acima).

Pronto: a partir daí, todo push de tag `v*` sobe o rascunho sozinho.

## Notas

- As variáveis lidas pela CLI são `EXTENSION_ID`, `CLIENT_ID`, `CLIENT_SECRET`,
  `REFRESH_TOKEN` — o workflow mapeia os secrets `CWS_*` para esses nomes.
- O script (`scripts/publish-store.mjs`) só faz `upload` (rascunho). Para publicar de
  fato via API no futuro, trocaríamos para `publish` / `--auto-publish` — hoje fica manual
  de propósito.
- O script falha se a tag (`vX.Y.Z`) não bater com a versão do `package.json`.
