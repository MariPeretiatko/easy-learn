import { useLayoutEffect, useRef, type ComponentProps } from "react";

/** Keep long content visible while the page or dialog handles scrolling. */
export function AutoTextarea({
  className = "",
  onInput,
  ...props
}: Omit<ComponentProps<"textarea">, "ref">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const field = ref.current;
    if (!field) return;
    const style = getComputedStyle(field);
    const border =
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight + border}px`;
  };
  useLayoutEffect(fit, [props.value, props.defaultValue, props.rows]);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    let width = field.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const nextWidth = field.getBoundingClientRect().width;
      if (nextWidth !== width) {
        width = nextWidth;
        fit();
      }
    });
    observer.observe(field);
    let active = true;
    void document.fonts.ready.then(() => {
      if (active) fit();
    });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);
  return (
    <textarea
      {...props}
      ref={ref}
      className={`auto-textarea ${className}`}
      onInput={(event) => {
        onInput?.(event);
        fit();
      }}
    />
  );
}
