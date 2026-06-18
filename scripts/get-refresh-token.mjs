// Gera um REFRESH TOKEN da Chrome Web Store API para um OAuth client do tipo "App para
// computador" (Desktop). Roda um servidor de loopback local, abre o navegador para você
// autorizar e imprime o refresh token no terminal.
//
// Uso:
//   node scripts/get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>
//   (ou exporte CLIENT_ID / CLIENT_SECRET no ambiente)
//
// Pré-requisitos: tela de consentimento OAuth configurada e PUBLICADA (Em produção) e a
// "Chrome Web Store API" habilitada no projeto. Veja RELEASING.md.
import http from 'node:http';
import { execFile } from 'node:child_process';

const clientId = process.argv[2] || process.env.CLIENT_ID;
const clientSecret = process.argv[3] || process.env.CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Uso: node scripts/get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

const PORT = 8910;
const redirectUri = `http://localhost:${PORT}`;
const authUrl =
  'https://accounts.google.com/o/oauth2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/chromewebstore',
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, redirectUri).searchParams.get('code');
  if (!code) {
    res.end('Sem "code" na URL. Pode fechar.');
    return;
  }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const data = await r.json();
    if (data.refresh_token) {
      console.log('\n✓ REFRESH TOKEN:\n\n' + data.refresh_token + '\n');
      res.end('Pronto! Refresh token gerado. Pode fechar esta aba e voltar ao terminal.');
    } else {
      console.error('\n✗ Resposta sem refresh_token:\n', data, '\n');
      res.end('Erro: ' + JSON.stringify(data));
    }
  } catch (e) {
    console.error(e);
    res.end('Erro ao trocar o code pelo token.');
  } finally {
    setTimeout(() => { server.close(); process.exit(0); }, 300);
  }
});

server.listen(PORT, () => {
  console.log('\nAbra esta URL no navegador (logado na conta de desenvolvedor da store):\n\n' + authUrl + '\n');
  execFile('open', [authUrl], () => {}); // macOS: tenta abrir automaticamente
});
