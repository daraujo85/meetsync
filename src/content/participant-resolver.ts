// Resolução de avatar de participante (RF-052/053).
// Quando a legenda traz uma <img> de avatar, usamos a src dela. Caso não haja avatar,
// a UI cai no fallback de iniciais (tratado no componente de chat).

/** Extrai uma URL de avatar a partir de um nó de legenda, se houver <img> com src http(s). */
export function avatarFromCaptionRow(row: Element): string | undefined {
  const img = row.querySelector('img');
  const src = img?.getAttribute('src') ?? undefined;
  if (src && /^https?:\/\//.test(src)) return src;
  return undefined;
}

/** Iniciais a partir do nome, para avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
