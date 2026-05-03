/**
 * Walking Skeleton (#82) のエントリ画面。
 *
 * 目的:
 *  1. `GET /api/templates` を叩いてテンプレート一覧を表示する
 *  2. `/ws?executionId=stub` に接続し、受信した `agent:status` をそのまま表示する
 *
 * UX は最低限。状態パターン（loading / empty / error）は ui-patterns.md §3 の
 * テキスト主体・節度の判断軸に従い、shadcn コンポーネント未導入分はプレーンな
 * Tailwind で表現する。後続 Issue で `Skeleton` / `Badge` 等を導入した時点で
 * 置き換える。
 */

import type {
  GetTemplatesResponse,
  TemplateSummary,
  WsMessage,
} from "@agent-team-studio/shared";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";

type TemplatesState =
  | { kind: "loading" }
  | { kind: "ready"; items: TemplateSummary[] }
  | { kind: "error"; message: string };

type WsMessageEntry = { seq: number; message: WsMessage };

type WsState =
  | { kind: "connecting" }
  | { kind: "open"; messages: WsMessageEntry[] }
  | { kind: "closed"; messages: WsMessageEntry[]; code: number };

export function App() {
  const [templates, setTemplates] = useState<TemplatesState>({
    kind: "loading",
  });
  const [ws, setWs] = useState<WsState>({ kind: "connecting" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/templates")
      .then(async (res) => {
        if (!res.ok) throw new Error(`status=${res.status}`);
        return (await res.json()) as GetTemplatesResponse;
      })
      .then((body) => {
        if (!cancelled) setTemplates({ kind: "ready", items: body.items });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setTemplates({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const url = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws?executionId=stub`;
    const socket = new WebSocket(url);
    const buffer: WsMessageEntry[] = [];
    let seq = 0;
    socket.addEventListener("open", () => {
      setWs({ kind: "open", messages: [...buffer] });
    });
    socket.addEventListener("message", (ev) => {
      const message = JSON.parse(ev.data as string) as WsMessage;
      seq += 1;
      buffer.push({ seq, message });
      setWs((prev) =>
        prev.kind === "closed" ? prev : { kind: "open", messages: [...buffer] },
      );
    });
    socket.addEventListener("close", (ev) => {
      setWs({ kind: "closed", messages: [...buffer], code: ev.code });
    });
    return () => {
      socket.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        <section>
          <h1 className="mb-3 text-xl font-semibold">テンプレート一覧</h1>
          {templates.kind === "loading" && (
            <p className="text-sm text-muted-foreground">読み込み中…</p>
          )}
          {templates.kind === "error" && (
            <p className="text-sm text-destructive">
              読み込みに失敗しました: {templates.message}
            </p>
          )}
          {templates.kind === "ready" && templates.items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              テンプレートがありません
            </p>
          )}
          {templates.kind === "ready" && templates.items.length > 0 && (
            <ul className="space-y-2">
              {templates.items.map((tpl) => (
                <li
                  key={tpl.id}
                  className="rounded-md border bg-card p-3 text-card-foreground"
                >
                  <div className="font-medium">{tpl.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {tpl.description}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">WebSocket メッセージ</h2>
          {ws.kind === "connecting" && (
            <p className="text-sm text-muted-foreground">接続中…</p>
          )}
          {(ws.kind === "open" || ws.kind === "closed") &&
            ws.messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                メッセージ未受信
                {ws.kind === "closed" && `（close code=${ws.code}）`}
              </p>
            )}
          {(ws.kind === "open" || ws.kind === "closed") &&
            ws.messages.length > 0 && (
              <ul aria-live="polite" className="space-y-2">
                {ws.messages.map((entry) => (
                  <li key={entry.seq} className="rounded-md border bg-card p-3">
                    <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
                      {JSON.stringify(entry.message, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </main>
    </div>
  );
}
