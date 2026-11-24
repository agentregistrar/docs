import { defineMiddleware } from "astro:middleware";

/**
 * Replaces NimbusHead's self-referential `<link rel="canonical">` when a page
 * sets an external `canonicalUrl` (used by generated protocol spec pages whose
 * canonical home is https://agentidentityprotocol.dev).
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const canonicalUrl = context.locals.canonicalUrl;
  if (!canonicalUrl) return response;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const updated = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${canonicalUrl}">`,
  );

  return new Response(updated, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
});
