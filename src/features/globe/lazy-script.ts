export function activateLazyScript(root: ParentNode, name: string) {
  const template = root.querySelector<HTMLTemplateElement>(`template[data-lazy-script="${name}"]`);

  const source = template?.dataset.src;

  if (template === null || source === undefined) return;

  const script = document.createElement("script");

  script.type = "module";
  script.src = source;
  script.dataset.lazyScript = name;
  template.replaceWith(script);
}
