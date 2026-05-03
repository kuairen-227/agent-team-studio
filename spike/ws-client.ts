// Issue #81 Spike: ws-server.ts に対する検証クライアント。
// 3 ケースを連続実行し、サーバ側のログと突き合わせる:
//   A. 不正な executionId (close 4404 を確認)
//   B. 正常接続 → サーバ主導で全 push 受信後 close 1000
//   C. 正常接続 → 受信途中でクライアント主導 close (サーバの onClose 発火を確認)
const PORT = Number.parseInt(process.env.PORT ?? "", 10) || 3100;
const URL = `ws://localhost:${PORT}/ws`;

type CaseResult = {
  name: string;
  receivedTypes: string[];
  closeCode: number;
  closeReason: string;
  durationMs: number;
};

function runCase(
  name: string,
  url: string,
  closeAfterMessages?: number,
): Promise<CaseResult> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const ws = new WebSocket(url);
    const receivedTypes: string[] = [];
    let received = 0;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(String(e.data));
        receivedTypes.push(msg.type);
      } catch {
        receivedTypes.push("<non-json>");
      }
      received += 1;
      if (closeAfterMessages !== undefined && received >= closeAfterMessages) {
        console.log(
          `[client:${name}] closing client-side after ${received} msgs`,
        );
        ws.close(1000, "client_done");
      }
    };
    ws.onclose = (e) => {
      resolve({
        name,
        receivedTypes,
        closeCode: e.code,
        closeReason: e.reason,
        durationMs: Date.now() - start,
      });
    };
    ws.onerror = (e) => reject(new Error(`ws error: ${String(e)}`));
  });
}

const results: CaseResult[] = [];

console.log("=== Case A: invalid executionId ===");
results.push(await runCase("A:invalid", `${URL}?executionId=`));

console.log("=== Case B: normal full receive ===");
results.push(await runCase("B:normal-full", `${URL}?executionId=spike-b`));

console.log("=== Case C: client-initiated close mid-stream ===");
results.push(await runCase("C:client-close", `${URL}?executionId=spike-c`, 3));

console.log("\n=== Summary ===");
console.table(
  results.map((r) => ({
    case: r.name,
    closeCode: r.closeCode,
    closeReason: r.closeReason,
    msgCount: r.receivedTypes.length,
    types: r.receivedTypes.join(","),
    ms: r.durationMs,
  })),
);
