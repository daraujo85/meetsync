// Utilitário compartilhado para resolver o emoji de uma reação (Meet + Teams).
// Reações são efêmeras e o glifo nem sempre vem no DOM — daí o mapa por nome (PT/EN).

export const REACTION_NAME_MAP: [RegExp, string][] = [
  [/heart|amor|cora[cç][aã]o|love/i, '❤️'],
  [/like|curtir|gostei|joinha|thumbs/i, '👍'],
  [/applause|aplauso|palmas|clap/i, '👏'],
  [/laugh|riso|\brir\b|haha|engra[cç]|funny|joy/i, '😆'],
  [/wow|uau|surpres|surprise/i, '😮'],
  [/sad|triste|chor|cry/i, '😢'],
  [/party|festa|celebrat|comemora|tada/i, '🎉'],
  [/fire|fogo/i, '🔥'],
];

const EMOJI_RE = /[\p{Extended_Pictographic}]/u;

/** Resolve o emoji: usa o glifo se presente no texto; senão mapeia pelo nome; senão 👍. */
export function resolveEmoji(raw: string): string {
  const glyph = raw.match(EMOJI_RE);
  if (glyph) return glyph[0];
  for (const [re, e] of REACTION_NAME_MAP) if (re.test(raw)) return e;
  return '👍';
}

/** O texto (trim) é composto só de emoji(s)? Útil para detectar reações no DOM. */
export function isEmojiOnly(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 8) return false;
  return EMOJI_RE.test(t) && !/[a-zA-Z0-9À-ÿ]/.test(t);
}
