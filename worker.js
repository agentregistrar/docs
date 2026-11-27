const AGENT_UA_RE = /Claude-User|ChatGPT-User|Perplexity-User/i;

function sanitizePathname(rawUrl) {
  const { pathname } = new URL(rawUrl);
  return pathname
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .slice(0, 256);
}

function wantsMarkdown(request) {
  const accept = (request.headers.get("accept") || "").toLowerCase();
  if (accept.includes("text/markdown")) return true;
  const ua = request.headers.get("user-agent") || "";
  return AGENT_UA_RE.test(ua) && !accept.includes("text/html");
}

function buildMarkdown404(pathname) {
  return [
    "# Error 404: Documentation page not found",
    "",
    `The path \`${pathname}\` does not exist on \`https://docs.agentregistrar.dev\`.`,
    "",
    "## Documentation indexes",
    "",
    "- Agent documentation index: [https://docs.agentregistrar.dev/llms.txt](https://docs.agentregistrar.dev/llms.txt)",
    "- Full documentation Markdown bundle: [https://docs.agentregistrar.dev/llms-full.txt](https://docs.agentregistrar.dev/llms-full.txt)",
    "- Documentation home: [https://docs.agentregistrar.dev/](https://docs.agentregistrar.dev/)",
    "- Sitemap: [https://docs.agentregistrar.dev/sitemap-index.xml](https://docs.agentregistrar.dev/sitemap-index.xml)",
    "- Broker index: [https://agentregistrar.dev/llms.txt](https://agentregistrar.dev/llms.txt)",
    "",
  ].join("\n");
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return env.ASSETS.fetch(request);
    }

    if (wantsMarkdown(request)) {
      const pathname = sanitizePathname(request.url);
      const body = request.method === "HEAD" ? null : buildMarkdown404(pathname);
      return new Response(body, {
        status: 404,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          Vary: "Accept, User-Agent",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      });
    }

    const assetResponse = await env.ASSETS.fetch(new URL("/404.html", request.url));
    const headers = new Headers(assetResponse.headers);
    headers.set("Vary", "Accept, User-Agent");

    if (request.method === "HEAD") {
      await assetResponse.body?.cancel();
      return new Response(null, { status: 404, headers });
    }

    return new Response(assetResponse.body, {
      status: 404,
      headers,
    });
  },
};
