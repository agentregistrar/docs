import { generateOpenGraphImage } from "astro-og-canvas";
import { ogCardConfig } from "./og/_og-card-config";

export const prerender = true;

export async function GET() {
  const body = await generateOpenGraphImage({
    title: "agentregistrar_ docs",
    description: "agent identity, brokered. | docs.agentregistrar.dev",
    ...ogCardConfig,
  });

  return new Response(body, {
    headers: { "Content-Type": "image/png" },
  });
}
