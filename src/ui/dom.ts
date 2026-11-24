export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  attrs?: Record<string, string>,
  children?: (Node | string)[],
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (children) children.forEach((c) => e.append(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}

export function text<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, content: string) {
  const e = el(tag, cls);
  e.textContent = content;
  return e;
}

export const monogramSVG = (letters: string) => `
<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="1"/>
  <circle cx="32" cy="32" r="26.5" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.6"/>
  <path d="M32 9 C 35 14, 35 17, 32 20 C 29 17, 29 14, 32 9 Z" fill="currentColor" opacity="0.8"/>
  <text x="32" y="41" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="17" letter-spacing="1" fill="currentColor">${letters.replace(/[<>&]/g, '')}</text>
</svg>`;
