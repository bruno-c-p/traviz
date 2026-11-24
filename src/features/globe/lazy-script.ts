function lazyScriptTemplate(root: ParentNode, name: string): HTMLTemplateElement | null {
  return root.querySelector<HTMLTemplateElement>(`template[data-lazy-script="${name}"]`);
}

export function preloadLazyScript(root: ParentNode, name: string) {
  const source = lazyScriptTemplate(root, name)?.dataset.src;

  if (source === undefined) return;

  const link = document.createElement("link");

  link.rel = "modulepreload";
  link.href = source;
  document.head.append(link);
}

export function activateLazyScript(root: ParentNode, name: string) {
  const template = lazyScriptTemplate(root, name);
  const source = template?.dataset.src;

  if (template === null || source === undefined) return;

  const script = document.createElement("script");

  script.type = "module";
  script.src = source;
  script.dataset.lazyScript = name;
  template.replaceWith(script);
}
