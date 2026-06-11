// Mini-helper de criação de elementos (sem framework).

type Attrs = Record<string, string | number | boolean | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else if (k === 'text') node.textContent = String(v);
    else if (k.startsWith('data-') || k === 'role' || k.startsWith('aria-') || k === 'title' || k === 'type' || k === 'placeholder' || k === 'value')
      node.setAttribute(k, String(v));
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(c);
  return node;
}
