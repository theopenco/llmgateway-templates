import { beforeEach, describe, expect, it, vi } from "vitest";

const redisState = {
  connect: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
};

const createRedisState = vi.fn(() => redisState);

vi.mock("@chat-adapter/state-redis", () => ({
  createRedisState,
}));

describe("state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("exports the redis-backed state adapter", async () => {
    const { state } = await import("../src/lib/state.js");

    expect(createRedisState).toHaveBeenCalledTimes(1);
    expect(state).toBe(redisState);
  });
});
