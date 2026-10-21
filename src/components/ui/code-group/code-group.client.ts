import { initTabs, mount } from "@cloudflare/nimbus-docs/client";

let counter = 0;

function extractCodeText(pre: HTMLElement): string {
  const code = pre.querySelector("code");
  return code?.textContent ?? pre.textContent ?? "";
}

function buildPanel(
  pre: HTMLPreElement,
  panelId: string,
  tabId: string,
  selected: boolean,
): HTMLElement {
  const panel = document.createElement("div");
  panel.role = "tabpanel";
  panel.id = panelId;
  panel.setAttribute("aria-labelledby", tabId);
  panel.dataset.cgPanel = "";
  panel.className = "relative overflow-hidden bg-well text-inherit";
  if (!selected) panel.hidden = true;

  const row = document.createElement("div");
  row.dataset.cgRow = "";
  if (pre.dataset.nbLang) row.dataset.nbLang = pre.dataset.nbLang;

  pre.dataset.cgPre = "";
  row.appendChild(pre);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.dataset.cgCopy = "";
  copyBtn.dataset.code = extractCodeText(pre);
  copyBtn.setAttribute("aria-label", "copy code to clipboard");
  copyBtn.textContent = "copy";
  row.appendChild(copyBtn);

  panel.appendChild(row);
  return panel;
}

mount("[data-cg]", (root) => {
  const tablist = root.querySelector<HTMLElement>("[data-cg-tablist]");
  const rawHost = root.querySelector<HTMLElement>("[data-cg-panels-raw]");
  const panelsHost = root.querySelector<HTMLElement>("[data-cg-panels]");
  if (!tablist || !rawHost || !panelsHost) return () => {};

  const pres = Array.from(rawHost.querySelectorAll<HTMLPreElement>("pre"));
  if (pres.length === 0) return () => {};

  let explicit: string[] | null = null;
  const titlesAttr = root.dataset.titles;
  if (titlesAttr) {
    try {
      explicit = JSON.parse(titlesAttr);
    } catch {
      explicit = null;
    }
  }

  const id = `cg-${counter++}`;

  pres.forEach((pre, i) => {
    const label = explicit?.[i] ?? `Tab ${i + 1}`;
    const panelId = `${id}-panel-${i}`;
    const tabId = `${id}-tab-${i}`;
    const selected = i === 0;

    const btn = document.createElement("button");
    btn.role = "tab";
    btn.type = "button";
    btn.id = tabId;
    btn.setAttribute("aria-controls", panelId);
    btn.setAttribute("aria-selected", selected ? "true" : "false");
    btn.textContent = label;
    btn.dataset.cgTab = "";
    btn.className =
      "m-0 cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-3 py-1.5 text-sm leading-5 font-medium text-muted transition-colors duration-100 hover:text-foreground aria-selected:border-accent aria-selected:text-foreground";
    tablist.appendChild(btn);

    panelsHost.appendChild(buildPanel(pre, panelId, tabId, selected));
  });

  rawHost.remove();

  // Track every copy-button click listener plus the pending "reset" timers it
  // schedules, so teardown can remove each listener the init added and cancel a
  // timer that would otherwise fire against a detached button after a swap.
  const timers = new Set<number>();
  const copyListeners: Array<[HTMLButtonElement, EventListener]> = [];

  panelsHost.querySelectorAll<HTMLButtonElement>("[data-cg-copy]").forEach((btn) => {
    const onCopy = async () => {
      const code = btn.dataset.code ?? "";
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        return;
      }
      btn.textContent = "copied";
      btn.dataset.state = "copied";
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        btn.textContent = "copy";
        delete btn.dataset.state;
      }, 1500);
      timers.add(timer);
    };
    btn.addEventListener("click", onCopy);
    copyListeners.push([btn, onCopy as EventListener]);
  });

  const tabs = initTabs({
    container: root,
    tabSelector: "[data-cg-tab]",
    panelSelector: "[data-cg-panel]",
    rovingTabindex: true,
  });

  return () => {
    for (const [btn, onCopy] of copyListeners) {
      btn.removeEventListener("click", onCopy);
    }
    for (const timer of timers) window.clearTimeout(timer);
    timers.clear();
    tabs.destroy();
  };
});
