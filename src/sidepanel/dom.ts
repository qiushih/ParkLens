type Child = Node | string | null;

/** Builds an element. Strings become text nodes, so URL-derived text is never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...children.filter((c): c is Node | string => c !== null));
  return element;
}
