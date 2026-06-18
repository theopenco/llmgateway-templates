import { beforeEach, describe, expect, it, vi } from "vitest";

const webhookHandler = vi.fn(() => new Response("ok", { status: 200 }));

vi.mock("../src/bot.js", () => ({
  bot: {
    webhooks: {
      slack: webhookHandler,
    },
  },
}));

describe("app routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responds to the health check", async () => {
    const { default: app } = await import("../src/index.js");

    const response = await app.fetch(new Request("http://localhost/"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bot: "qa-bot", status: "ok" });
  });

  it("routes the slack webhook to the adapter handler", async () => {
    const { default: app } = await import("../src/index.js");
    const request = new Request("http://localhost/api/webhooks/slack", {
      method: "POST",
    });

    const response = await app.fetch(request);

    expect(webhookHandler).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
  });

  it("returns 404 for unknown platforms", async () => {
    const { default: app } = await import("../src/index.js");

    const response = await app.fetch(
      new Request("http://localhost/api/webhooks/teams", { method: "POST" }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Unknown platform: teams",
    });
    expect(webhookHandler).not.toHaveBeenCalled();
  });
});
