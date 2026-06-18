import { beforeEach, describe, expect, it, vi } from "vitest";

const serve = vi.fn();
const app = { fetch: vi.fn() };
let serveCallback: (() => void) | undefined;

vi.mock("@hono/node-server", () => ({
  serve: (
    options: { fetch: typeof app.fetch; port: number },
    handler: () => void,
  ) => {
    serve(options, handler);
    serveCallback = handler;
  },
}));

vi.mock("../src/index.js", () => ({
  default: app,
}));

describe("local server entrypoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.PORT = "4567";
  });

  it("starts the server on the configured port", async () => {
    await import("../src/lib/local.js");

    expect(serve).toHaveBeenCalledWith(
      { fetch: app.fetch, port: 4567 },
      expect.any(Function),
    );

    serveCallback?.();
  });

  it("falls back to port 3000 when no port is configured", async () => {
    delete process.env.PORT;

    await import("../src/lib/local.js");

    expect(serve).toHaveBeenCalledWith(
      { fetch: app.fetch, port: 3000 },
      expect.any(Function),
    );
  });

  it("coerces a non-numeric port to the default", async () => {
    process.env.PORT = "not-a-number";

    await import("../src/lib/local.js");

    expect(serve).toHaveBeenCalledWith(
      { fetch: app.fetch, port: 3000 },
      expect.any(Function),
    );
  });
});
