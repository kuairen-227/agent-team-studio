import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fetchJson, isExpectedClientError } from "./api";

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

  test("ok=true でも不正 JSON のとき SyntaxError が伝播する", async () => {
    global.fetch = mock().mockResolvedValueOnce(
      new Response("not-json", { status: 200 }),
    ) as unknown as typeof fetch;

    // SyntaxError は /^status=4\d\d$/ にマッチしないため retry 対象になる（意図的な挙動）
    await expect(fetchJson("/api/test")).rejects.toThrow(SyntaxError);
  });

  test("fetch が TypeError を投げたときそのまま伝播する", async () => {
    global.fetch = mock().mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    ) as unknown as typeof fetch;

    await expect(fetchJson("/api/test")).rejects.toThrow(TypeError);
  });
});

describe("isExpectedClientError", () => {
  test("status=4xx は想定内クライアントエラー", () => {
    expect(isExpectedClientError(new Error("status=400"))).toBe(true);
    expect(isExpectedClientError(new Error("status=404"))).toBe(true);
    expect(isExpectedClientError(new Error("status=499"))).toBe(true);
  });

  test("status=5xx・ネットワークエラー・非 Error は想定外", () => {
    expect(isExpectedClientError(new Error("status=500"))).toBe(false);
    expect(isExpectedClientError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isExpectedClientError(new SyntaxError("bad json"))).toBe(false);
    expect(isExpectedClientError("status=404")).toBe(false);
    expect(isExpectedClientError(null)).toBe(false);
  });
});
