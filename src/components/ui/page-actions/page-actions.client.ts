import { mount } from "@cloudflare/nimbus-docs/client";

function initPageActions(root: HTMLElement): () => void {
  const copyBtn = root.querySelector<HTMLButtonElement>("[data-nb-page-actions-copy]");
  const label = root.querySelector<HTMLSpanElement>("[data-nb-page-actions-label]");
  const mdUrl = root.dataset.mdUrl;

  if (!copyBtn || !label || !mdUrl) return () => {};

  let resetTimer: number | undefined;

  function showState(text: string) {
    label!.textContent = text;
    if (resetTimer) window.clearTimeout(resetTimer);
    if (text !== "copy markdown") {
      resetTimer = window.setTimeout(() => {
        label!.textContent = "copy markdown";
      }, 1500);
    }
  }

  async function handleCopyPage() {
    const markdown = fetch(mdUrl!).then(async (res) => {
      if (!res.ok) throw new Error(`${res.status}`);
      return new Blob([await res.text()], { type: "text/plain" });
    });
    markdown.catch(() => {});
    try {
      // Hand the clipboard a pending item inside the click: Safari refuses a
      // write that starts after the fetch resolves.
      if (typeof ClipboardItem === "function") {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": markdown })]);
      } else {
        await navigator.clipboard.writeText(await (await markdown).text());
      }
      showState("copied");
    } catch {
      showState("copy failed");
    }
  }

  copyBtn.addEventListener("click", handleCopyPage);

  return () => {
    if (resetTimer) window.clearTimeout(resetTimer);
    copyBtn.removeEventListener("click", handleCopyPage);
  };
}

mount("[data-nb-page-actions]", initPageActions);
