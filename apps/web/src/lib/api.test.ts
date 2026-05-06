import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fetchJson } from "./api";

describe("fetchJson", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("ok=true のとき JSON をパースして返す", async () => {
    const mockFn = mock().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "1", name: "test" }), { status: 200 }),
    );
    global.fetch = mockFn as unknown as typeof fetch;

    const result = await fetchJson<{ id: string; name: string }>("/api/test");

    expect(result).toEqual({ id: "1", name: "test" });
    expect(mockFn).toHaveBeenCalledWith("/api/test");
  });

  test("ok=false (404) のとき Error('status=404') を throw する", async () => {
    global.fetch = mock().mockResolvedValueOnce(
      new Response(null, { status: 404 }),
    ) as unknown as typeof fetch;

    await expect(fetchJson("/api/not-found")).rejects.toThrow("status=404");
  });

  test("ok=false (500) のとき Error('status=500') を throw する", async () => {
    global.fetch = mock().mockResolvedValueOnce(
      new Response(null, { status: 500 }),
    ) as unknown as typeof fetch;

    await expect(fetchJson("/api/error")).rejects.toThrow("status=500");
  });

  test("fetch が TypeError を投げたときそのまま伝播する", async () => {
    global.fetch = mock().mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    ) as unknown as typeof fetch;

    await expect(fetchJson("/api/test")).rejects.toThrow(TypeError);
  });
});
