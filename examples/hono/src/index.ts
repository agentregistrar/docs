import { serve } from "@hono/node-server";
import { app } from "./app";

const port = 3004;

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(`Hono example listening on http://127.0.0.1:${info.port}`);
});
