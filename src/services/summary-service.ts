// Correção e resumo/ata via Ollama (§16/§17). Só roda sob ação explícita do usuário
// (download/processar) e com Ollama configurado (RF-082/084, RF-091/092, RNF-009).

import type { MeetingSession } from '@/types';
import { ollama } from './ollama-client';
import { buildTranscriptBody, formatTime } from './export-txt';

function formatDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const CORRECTION_PROMPT = `Você receberá uma transcrição capturada automaticamente do Google Meet (legendas).
Corrija erros de reconhecimento de fala, pontuação e quebras de frase, preservando fielmente o sentido.

Regras:
- Não invente informações nem remova falas relevantes.
- NÃO altere o NOME DO PARTICIPANTE que aparece antes dos dois-pontos (o "Nome:" de cada linha). Corrija apenas o TEXTO falado.
- Preserve os horários [HH:MM] e o formato de cada linha: [HH:MM] Nome: texto.
- Mantenha o português do Brasil.

Corrija com atenção especial a NOMES DE PRODUTOS, MARCAS, FERRAMENTAS E TERMOS TÉCNICOS que a
transcrição automática costuma aportuguesar ou escrever errado — especialmente termos em inglês
ouvidos como palavras em português. Use a grafia oficial correta. Exemplos do tipo de erro a corrigir:
- "Cláudio Code" / "Cláudio Código" / "Cláudio" (no contexto de IA/código) → "Claude Code" / "Claude"
- "guité" / "guírrabe" → "Git" / "GitHub"
- "paitão" → "Python";  "javascripti" → "JavaScript";  "ó lama" / "olama" → "Ollama"
- "vsicode" / "VS code" → "VS Code";  "no js" → "Node.js";  "react" → "React"
Use o CONTEXTO da conversa (assuntos técnicos, dev, IA) para inferir o termo correto. Quando o termo
claramente se refere a um produto/tecnologia conhecido, prefira a grafia oficial dele.

Contexto da reunião (use para entender o tema e desambiguar termos):
{{MEETING_METADATA}}

IMPORTANTE — formato da resposta:
- Responda APENAS com a transcrição corrigida, nada além disso.
- NÃO inclua preâmbulo, saudação, comentários, conclusão nem lista de alterações.
- NÃO adicione títulos, observações, notas de rodapé ou marcações de markdown.
- A primeira linha da sua resposta já deve ser a primeira linha da transcrição.

Transcrição:
{{TRANSCRIPT}}`;

const SUMMARY_PROMPT = `Você receberá a transcrição de uma reunião.
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
- Quando algo não estiver claro, escreva "não identificado na transcrição".
- Seja direto, profissional e útil.

Dados da reunião:
{{MEETING_METADATA}}

Transcrição:
{{TRANSCRIPT}}`;

function meetingMetadata(session: MeetingSession): string {
  return [
    `Reunião: ${session.meetingTitle || 'sem título'}`,
    `Link: ${session.meetingUrl || '—'}`,
    `Código: ${session.meetingCode || '—'}`,
    `Data: ${formatDate(session.captureStartedAt)}`,
    `Início: ${formatTime(session.captureStartedAt)}`,
    `Fim: ${session.captureEndedAt ? formatTime(session.captureEndedAt) : '(em andamento)'}`,
    `Participantes: ${session.participants.map((p) => p.name).join(', ') || '—'}`,
  ].join('\n');
}

/** Corrige a transcrição. Retorna o texto corrigido (RF-085/086). */
export async function correctTranscript(
  session: MeetingSession,
  url: string,
  model: string,
): Promise<string> {
  const prompt = CORRECTION_PROMPT.replace('{{MEETING_METADATA}}', meetingMetadata(session)).replace(
    '{{TRANSCRIPT}}',
    buildTranscriptBody(session),
  );
  return ollama.generate(url, model, prompt);
}

function summaryPrompt(session: MeetingSession): string {
  return SUMMARY_PROMPT.replace('{{MEETING_METADATA}}', meetingMetadata(session)).replace(
    '{{TRANSCRIPT}}',
    buildTranscriptBody(session),
  );
}

/** Gera resumo/ata (RF-095..099). */
export async function summarizeMeeting(
  session: MeetingSession,
  url: string,
  model: string,
): Promise<string> {
  return ollama.generate(url, model, summaryPrompt(session));
}

/** Gera resumo/ata com streaming: onChunk recebe o texto acumulado a cada pedaço. */
export async function summarizeMeetingStream(
  session: MeetingSession,
  url: string,
  model: string,
  onChunk: (accumulated: string) => void,
): Promise<string> {
  return ollama.generateStream(url, model, summaryPrompt(session), onChunk);
}
