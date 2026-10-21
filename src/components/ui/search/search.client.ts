import { mount } from "@cloudflare/nimbus-docs/client";
import type { SearchProvider, SearchResult } from "@cloudflare/nimbus-docs/types";
import { provider } from "./providers/pagefind";

export interface SearchConfig {
  input: HTMLInputElement;
  resultsContainer: HTMLElement;
  emptyState: HTMLElement;
  provider: SearchProvider;
  onNavigate?: () => void;
}

export interface SearchInstance {
  reset(): Promise<void>;
  destroy(): void;
}

export function initSearch(config: SearchConfig): SearchInstance {
  const { input, resultsContainer, emptyState, provider, onNavigate } = config;

  let initialized = false;
  let activeIndex = -1;
  let resultIdCounter = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let activeController: AbortController | undefined;

  function getOptions(): HTMLElement[] {
    return Array.from(resultsContainer.querySelectorAll<HTMLElement>("[role='option']"));
  }

  function updateActive(newIndex: number): void {
    const options = getOptions();
    if (options.length === 0) {
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    activeIndex = Math.max(-1, Math.min(newIndex, options.length - 1));
    options.forEach((option, index) => {
      if (index === activeIndex) {
        option.setAttribute("data-highlighted", "");
        option.scrollIntoView({ block: "nearest" });
        input.setAttribute("aria-activedescendant", option.id);
      } else {
        option.removeAttribute("data-highlighted");
      }
    });
    if (activeIndex < 0) input.removeAttribute("aria-activedescendant");
  }

  function clearResults(): void {
    resultsContainer.replaceChildren();
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  /**
   * Pagefind returns flat page hits. The listbox groups them by the first
   * path segment (protocol, start, reference, ...) so the reader sees the
   * docs sections; the client still drives one option list, so keyboard
   * navigation and `aria-activedescendant` are unchanged.
   */
  function sectionLabel(url: string): string {
    const path = new URL(url, window.location.origin).pathname;
    const base = import.meta.env.BASE_URL.replace(/^\/+|\/+$/g, "");
    const stripped =
      base && (path === `/${base}` || path.startsWith(`/${base}/`))
        ? path.slice(base.length + 1) || "/"
        : path;
    const segment = stripped.split("/").filter(Boolean)[0];
    return segment ?? "docs";
  }

  function resultLink(title: string, href: string, className: string): HTMLAnchorElement {
    const link = document.createElement("a");
    link.href = href;
    link.className = className;
    link.textContent = title;
    link.addEventListener("click", () => onNavigate?.());
    return link;
  }

  function buildResult(result: SearchResult): HTMLElement {
    const option = document.createElement("div");
    option.id = `search-result-${resultIdCounter++}`;
    option.setAttribute("role", "option");
    option.className = "min-h-11 cursor-pointer border-l-2 border-transparent px-2 py-2 transition-colors duration-100 hover:bg-hover focus-within:bg-hover data-[highlighted]:bg-hover data-[highlighted]:border-accent";

    const link = resultLink(result.title, result.url, "block truncate text-sm font-medium text-foreground no-underline focus-visible:outline-none");
    option.appendChild(link);

    if (result.snippet) {
      const snippet = document.createElement("p");
      snippet.className = "mt-1 line-clamp-2 text-xs leading-relaxed text-muted";
      snippet.innerHTML = result.snippet;
      option.appendChild(snippet);
    }

    if (result.subResults?.length) {
      const subList = document.createElement("div");
      subList.className = "mt-2 border-l border-line pl-3";
      for (const sub of result.subResults.slice(0, 3)) {
        subList.appendChild(resultLink(sub.title, sub.url, "block truncate py-3.5 text-xs text-muted no-underline hover:text-foreground md:py-1"));
      }
      option.appendChild(subList);
    }

    option.addEventListener("click", (event) => {
      if ((event.target as Element | null)?.closest("a")) return;
      link.click();
    });

    return option;
  }

  async function ensureInitialized(): Promise<boolean> {
    if (initialized) return true;
    try {
      await provider.init?.();
      initialized = true;
      return true;
    } catch {
      emptyState.textContent = import.meta.env.DEV
        ? "search is available after a production build."
        : "search could not load. check your connection and reload the page. if it persists, ask the site owner to rebuild and deploy the search index.";
      return false;
    }
  }

  async function runSearch(query: string): Promise<void> {
    activeController?.abort();
    activeController = new AbortController();
    const signal = activeController.signal;

    emptyState.style.display = "";
    emptyState.textContent = "searching...";
    clearResults();

    if (!(await ensureInitialized()) || signal.aborted) return;

    try {
      const results = await provider.search(query, { signal });
      if (signal.aborted) return;

      clearResults();
      activeIndex = -1;

      if (results.length === 0) {
        emptyState.style.display = "";
        emptyState.textContent = "no results.";
        return;
      }

      emptyState.style.display = "none";
      input.setAttribute("aria-expanded", "true");
      const groups = new Map<string, SearchResult[]>();
      for (const result of results) {
        const label = sectionLabel(result.url);
        const bucket = groups.get(label);
        if (bucket) bucket.push(result);
        else groups.set(label, [result]);
      }
      for (const [label, bucket] of groups) {
        const group = document.createElement("div");
        group.setAttribute("role", "group");
        group.setAttribute("aria-label", label);
        group.className = "mb-1 last:mb-0";
        const heading = document.createElement("p");
        heading.className = "px-2 py-1 text-xs uppercase tracking-wider text-faint";
        heading.setAttribute("aria-hidden", "true");
        heading.textContent = label;
        group.appendChild(heading);
        for (const result of bucket) group.appendChild(buildResult(result));
        resultsContainer.appendChild(group);
      }
    } catch {
      if (signal.aborted) return;
      clearResults();
      emptyState.style.display = "";
      emptyState.textContent = "search is temporarily unavailable.";
    }
  }

  function handleInput(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = input.value.trim();
      if (!query) {
        activeController?.abort();
        clearResults();
        emptyState.style.display = "";
        emptyState.textContent = "type to search.";
        return;
      }
      void runSearch(query);
    }, 150);
  }

  function handleKeydown(event: KeyboardEvent): void {
    const options = getOptions();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateActive(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      updateActive(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      updateActive(options.length - 1);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      options[activeIndex]?.querySelector<HTMLAnchorElement>("a")?.click();
    }
  }

  input.addEventListener("input", handleInput);
  input.addEventListener("keydown", handleKeydown);

  return {
    async reset() {
      activeController?.abort();
      if (debounceTimer) clearTimeout(debounceTimer);
      input.value = "";
      input.focus();
      activeIndex = -1;
      clearResults();
      emptyState.style.display = "";
      emptyState.textContent = "type to search.";
      await ensureInitialized();
    },
    destroy() {
      activeController?.abort();
      if (debounceTimer) clearTimeout(debounceTimer);
      input.removeEventListener("input", handleInput);
      input.removeEventListener("keydown", handleKeydown);
    },
  };
}

// ---------------------------------------------------------------------------
// Bootstrap - imported for its side effects by SearchDialog.astro
// (`import "./search.client"`). Wires each dialog through mount() and binds the
// global open shortcut once.
// ---------------------------------------------------------------------------

type SearchDialogElement = HTMLDialogElement & {
  __openSearchDialog?: () => void;
};

function primaryDialog(): SearchDialogElement | null {
  return document.querySelector<SearchDialogElement>("[data-search-dialog][data-search-ready]");
}

// The open shortcut and trigger delegation live on `document`, which survives
// view transitions, so they are bound once for the page's lifetime - never
// through mount()'s per-element setup/teardown. A module-scoped boolean (not an
// <html> attribute) is the guard: ClientRouter resets <html> on every swap but
// keeps document listeners, so an attribute guard would stack a duplicate
// keydown handler each navigation (Cmd+K then toggles twice).
let globalsBound = false;

function bindGlobals() {
  if (globalsBound) return;
  globalsBound = true;

  document.addEventListener("click", (event) => {
    const trigger = (event.target as Element | null)?.closest("[data-search-trigger]");
    if (!trigger) return;
    primaryDialog()?.__openSearchDialog?.();
  });

  document.addEventListener("keydown", (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
    const dialog = primaryDialog();
    if (!dialog) return;
    event.preventDefault();
    if (dialog.open) dialog.close();
    else dialog.__openSearchDialog?.();
  });
}

// Per-element wiring: idempotent discovery now and on astro:page-load, teardown
// on astro:before-swap. Replaces the hand-rolled data-search-ready init loop;
// data-search-ready is now just the "wired" marker primaryDialog() selects on.
mount("[data-search-dialog]", (root) => {
  const dialog = root as SearchDialogElement;
  dialog.setAttribute("data-search-ready", "true");

  const input = dialog.querySelector<HTMLInputElement>("[data-search-input]");
  const resultsContainer = dialog.querySelector<HTMLElement>("[data-search-results]");
  const emptyState = dialog.querySelector<HTMLElement>("[data-search-empty]");
  if (!input || !resultsContainer || !emptyState) return () => {};

  const search = initSearch({
    input,
    resultsContainer,
    emptyState,
    provider,
    onNavigate: () => dialog.close(),
  });

  dialog.__openSearchDialog = () => {
    if (!dialog.open) dialog.showModal();
    void search.reset();
  };

  return () => search.destroy();
});

bindGlobals();
