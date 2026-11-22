/**
 * Shared client session loader for Agent Registrar docs personalization.
 *
 * Fetches GET <brokerOrigin>/api/docs/context with credentials included,
 * deduplicates in-flight requests, caches in sessionStorage for 60s, and
 * fails silently to { signed_in: false } on any network/CORS/parse error.
 */

export interface DocsContextService {
  org_slug: string;
  org_name: string;
  service_id: string;
  display_name: string;
  audience: string;
  status: "live" | "verified" | "pending" | "suspended";
  primary_origin: string | null;
  origin_verified: boolean;
  attestation_uri: string | null;
  provider_url: string | null;
  contact: string | null;
  portal_url: string;
}

export interface DocsContextSignedIn {
  signed_in: true;
  broker_issuer: string;
  human: {
    display_name: string;
    github_handle: string | null;
    email_verified: boolean;
    master_tos_signed: boolean;
    onboarded: boolean;
  };
  developer: {
    active_agent_count: number;
    dashboard_url: string;
  };
  provider: {
    org_count: number;
    portal_url: string;
    new_service_url: string;
    services: DocsContextService[];
  };
}

export type DocsContext = { signed_in: false } | DocsContextSignedIn;

const DEFAULT_BROKER_ORIGIN = "https://agentregistrar.dev";
const BROKER_OVERRIDE_KEY = "ar_docs_broker_origin";
const CONTEXT_CACHE_KEY = "ar_docs_context_v1";
const SELECTED_SERVICE_KEY = "ar_docs_selected_service_v1";
const SERVICE_CHANGE_EVENT = "ar-docs-service-change";
const CONTEXT_TTL_MS = 60_000;
const REFRESH_THROTTLE_MS = 10_000;

interface CachedContext {
  ts: number;
  origin: string;
  data: DocsContext;
}

let inflightRequest: Promise<DocsContext> | null = null;
let inflightOrigin: string | null = null;

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function normalizeOrigin(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getBrokerOrigin(): string {
  if (typeof window === "undefined") {
    return DEFAULT_BROKER_ORIGIN;
  }
  const hostname = window.location.hostname;
  if (hostname === "docs.agentregistrar.dev" || !isLocalHostname(hostname)) {
    return DEFAULT_BROKER_ORIGIN;
  }
  try {
    const override = normalizeOrigin(window.localStorage.getItem(BROKER_OVERRIDE_KEY));
    if (override) return override;
  } catch {
    // localStorage unavailable; fall back to default origin.
  }
  return DEFAULT_BROKER_ORIGIN;
}

export function getSignInUrl(returnUrl?: string): string {
  const origin = getBrokerOrigin();
  const nextUrl =
    returnUrl ??
    (typeof window !== "undefined"
      ? window.location.href
      : "https://docs.agentregistrar.dev/");
  return `${origin}/login?next=${encodeURIComponent(nextUrl)}`;
}

function isValidSignedInContext(raw: unknown): raw is DocsContextSignedIn {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  if (obj.signed_in !== true) return false;
  if (typeof obj.broker_issuer !== "string" || !obj.broker_issuer) return false;
  if (!obj.human || typeof obj.human !== "object") return false;
  if (!obj.developer || typeof obj.developer !== "object") return false;
  if (!obj.provider || typeof obj.provider !== "object") return false;
  const provider = obj.provider as Record<string, unknown>;
  if (!Array.isArray(provider.services)) return false;
  return true;
}

function parseDocsContext(raw: unknown): DocsContext {
  if (isValidSignedInContext(raw)) {
    return raw;
  }
  return { signed_in: false };
}

function readCachedContext(origin: string): DocsContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CONTEXT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedContext>;
    if (
      typeof parsed.ts !== "number" ||
      parsed.origin !== origin ||
      Date.now() - parsed.ts > CONTEXT_TTL_MS
    ) {
      window.sessionStorage.removeItem(CONTEXT_CACHE_KEY);
      return null;
    }
    if (!parsed.data || typeof parsed.data !== "object") return null;
    return parseDocsContext(parsed.data);
  } catch {
    return null;
  }
}

function writeCachedContext(origin: string, data: DocsContext): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedContext = {
      ts: Date.now(),
      origin,
      data,
    };
    window.sessionStorage.setItem(CONTEXT_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage unavailable; continue without cache.
  }
}

async function fetchContextFromOrigin(origin: string): Promise<DocsContext> {
  try {
    const response = await fetch(`${origin}/api/docs/context`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      const fallback: DocsContext = { signed_in: false };
      writeCachedContext(origin, fallback);
      return fallback;
    }
    const json: unknown = await response.json();
    const ctx = parseDocsContext(json);
    writeCachedContext(origin, ctx);
    return ctx;
  } catch {
    return { signed_in: false };
  }
}

export async function getDocsContext(options?: {
  force?: boolean;
}): Promise<DocsContext> {
  if (typeof window === "undefined") {
    return { signed_in: false };
  }

  const origin = getBrokerOrigin();
  const force = options?.force === true;

  if (!force) {
    const cached = readCachedContext(origin);
    if (cached) return cached;
  }

  if (inflightRequest && inflightOrigin === origin && !force) {
    return inflightRequest;
  }

  const request = fetchContextFromOrigin(origin);
  inflightRequest = request;
  inflightOrigin = origin;
  void request.finally(() => {
    if (inflightRequest === request) {
      inflightRequest = null;
      inflightOrigin = null;
    }
  });
  return request;
}

export function getSelectedServiceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(SELECTED_SERVICE_KEY);
  } catch {
    return null;
  }
}

export function setSelectedServiceId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SELECTED_SERVICE_KEY, id);
  } catch {
    // sessionStorage unavailable; still broadcast change to active page listeners.
  }
  window.dispatchEvent(
    new CustomEvent<{ serviceId: string }>(SERVICE_CHANGE_EVENT, {
      detail: { serviceId: id },
    }),
  );
}

export function subscribeDocsContextRefresh(
  cb: (ctx: DocsContext) => void,
): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  let active = true;
  let lastRefreshAt = 0;

  const triggerRefresh = async () => {
    if (!active) return;
    const now = Date.now();
    if (now - lastRefreshAt < REFRESH_THROTTLE_MS) return;
    lastRefreshAt = now;
    const ctx = await getDocsContext({ force: true });
    if (active) cb(ctx);
  };

  const handleFocus = () => {
    void triggerRefresh();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void triggerRefresh();
    }
  };

  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    active = false;
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}
