/** The local HTTP preview may not expose navigator.clipboard. */
export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.style.position = "fixed";
  field.style.opacity = "0";
  const active = document.activeElement;
  document.body.append(field);
  try {
    field.select();
    if (!document.execCommand("copy"))
      throw new Error(
        "Не удалось скопировать. Выделите и скопируйте текст вручную.",
      );
  } finally {
    field.remove();
    if (active instanceof HTMLElement) active.focus({ preventScroll: true });
  }
}
