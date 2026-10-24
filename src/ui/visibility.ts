import { esc } from "./helpers";

// Feedback stays in the surface the child is currently using. A native
// dialog's top layer otherwise hides the page-level toast completely.
export function inlineFeedback(message: string, idle = "") {
  return `<span class="inline-feedback${message ? " has-feedback" : ""}" data-inline-feedback data-idle-feedback="${esc(idle)}" ${message || idle ? "" : "hidden"}>${esc(message || idle)}</span>`;
}

export function updateFeedback(root: HTMLElement, message: string) {
  root.querySelectorAll<HTMLElement>("[data-inline-feedback]").forEach((el) => {
    const idle = el.dataset.idleFeedback ?? "";
    el.textContent = message || idle;
    el.hidden = !message && !idle;
    el.classList.toggle("has-feedback", !!message);
  });
}

export function watchStickyHeaders(root: HTMLElement) {
  const panel = root.querySelector<HTMLElement>(".zoom-top");
  const dialog = root.querySelector<HTMLElement>("#game-dialog");
  const title = dialog?.querySelector<HTMLElement>(".dialog-actions");
  const measure = () => {
    root.style.setProperty(
      "--device-scroll-top",
      `${(panel?.offsetHeight ?? 56) + 8}px`,
    );
    dialog?.style.setProperty(
      "--dialog-scroll-top",
      `${(title?.offsetHeight ?? 56) + 22}px`,
    );
  };
  measure();
  const observer = new ResizeObserver(measure);
  if (panel) observer.observe(panel);
  if (title) observer.observe(title);
  return () => observer.disconnect();
}
