import { Hono } from "hono";

import { bot } from "./bot.js";

const app = new Hono();

app.get("/", (c) => c.json({ bot: "qa-bot", status: "ok" }));

app.post("/api/webhooks/:platform", (c) => {
  const platform = c.req.param("platform");

  if (platform !== "slack") {
    return c.json({ error: `Unknown platform: ${platform}` }, 404);
  }

  return bot.webhooks.slack(c.req.raw);
});

export default app;
