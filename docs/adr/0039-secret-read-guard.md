# 0039. AI エージェントによるシークレット読取ガードの強化とシークレット管理方式

## Status

accepted

- 作成日: 2026-06-09
- 関連: [ADR-0037](./0037-ai-execution-sandbox-policy.md)（拡張元：permissions.deny が FS・機密を担う分担）, [ADR-0007](./0007-ai-driven-dev-architecture.md)（前提：hooks による決定論的 enforcement・品質保証層）, [ADR-0018](./0018-relocate-compose-and-consolidate-env.md) / [ADR-0028](./0028-split-env-infra-and-app.md)（前提：env ファイル構造）, Issue #292, Issue #269（親トラッカ）, Issue #289 / #290 / #291（後続：自律ループ Phase 1–3）

## Context

[ADR-0037](./0037-ai-execution-sandbox-policy.md) は Claude Code の Bash サンドボックスを見送り、**FS・機密の隔離は `permissions.deny` + DevContainer + secretlint が担う**と分担を定めた。無人・長時間の自律実行（#289–291）に近づくほど、シークレット漏洩・exfiltration の安全網の価値が上がる。そこで ADR-0037 の「permissions.deny によるシークレット読取遮断」層を具体化・強化する。

現状の保護に、公式ドキュメントで確認した 3 つの穴がある:

1. **glob 不足**: deny は `Read(**/.env)` / `Read(**/.env.local)` のみ。`.env.production` 等の変種は Read で通る。
2. **サブプロセス・バイパス**: Read/Edit の deny は Claude が認識するファイルコマンド（`cat` / `head` / `tail` / `sed` / `grep`）には効くが、`source .env` / `printenv` / `env` / `bun -e`・`node`・`python` 等がファイルを直接開く経路には**効かない**（[公式明記](https://code.claude.com/docs/en/permissions)）。
3. **平文 `.env` がディスク上に存在**: ルート `.env` は compose が読むため平文で置かれる。読取をいくら塞いでも平文がディスクにある限り露出面が残る。

本アプリは LLM API キーをローカルで実際に使うため「実シークレットを置かない」は採れない。狙いを **(1) 平文をディスクに置かない (2) Claude のシェル env に晒さない**に定める。

## Considered Alternatives

### 論点 1: 読取試行の封鎖方式

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | deny glob の拡張のみ | 却下 — glob 不足（穴 1）は塞げるが、サブプロセス・バイパス（穴 2）は Read/Edit deny の対象外で残る（公式仕様） |
| B | deny glob 拡張 ＋ PreToolUse(Bash) ガードフック | **採用** — deny がカバーしない `source` / `printenv` / `bun -e` 等の経路を、コマンド文字列の決定論的検査でブロックする（[ADR-0007](./0007-ai-driven-dev-architecture.md) の hooks による enforcement と同機構）。入力 parse 不可時はフェイルオープン（理由: フェイルクローズは全 Bash を誤遮断するリスクがあり、Read deny ＋ egress firewall が backstop を担うため） |

### 論点 2: 平文をディスクから排除するシークレット管理ツール

| # | 選択肢 | 無料 | 判定 |
| - | --- | --- | --- |
| A | 現状維持（平文 `.env`） | — | 却下 — 露出面（穴 3）が残る |
| B | **dotenvx**（CLI で暗号化 at-rest・ローカル完結） | ✅ OSS | ~~採用（方向）~~ → **[ADR-0040](./0040-defer-secret-at-rest-encryption.md) で再評価し見送り**（当時は採用方向。無料・アカウント不要・外部 SaaS 非依存で `.env.keys` 1 点に集約できる利点を評価したが、トポロジー上 at-rest 暗号化が二次層にとどまり主価値が gitignore+secretlint と冗長なため取り下げ） |
| C | Infisical（OSS・self-host 無料 / 無料クラウド枠） | ✅/△ | 次点 — OSS の本格基盤だが self-host の運用コストが学習スコープ過大 |
| D | 1Password（`op run` で平文をディスクに残さない） | ❌ 有料 | 却下 — 無料前提では対象外（既契約なら再評価可） |
| E | Doppler（SaaS・無料枠） | △ | 却下 — proprietary SaaS でアカウント必須、ローカル完結しない |

## Decision

1. **Read deny を実シークレット変種に拡張する。** `Read(**/.env)` / `Read(**/.env.local)` に加え、`Read(**/.env.*.local)` / `Read(**/.env.keys)` / `Read(**/.env.production)` / `Read(**/.env.development)` / `Read(**/.env.staging)` / `Read(**/.env.test)` を deny する。**`.env.example` / `.env.sample` は deny に含めない**（秘密を持たないテンプレートで、Edit 前の Read やドキュメント参照に必要なため可読を維持する）。

2. **PreToolUse(Bash) ガードフックを導入する。** `.claude/hooks/guard-secret-access.sh` を `.claude/settings.json` の `PreToolUse`（matcher: `Bash`）に登録する。コマンド文字列が以下を参照したら deny（exit 2）:
   - `.env` および全変種（`.env.local` / `.env.production` / `.env.keys` ...）。`.environment` 等は誤検知しない（ファイル名トークンとして判定）
   - `printenv` / 単体の `env`（環境変数ダンプ）/ `/proc/*/environ`
   - `.env.example` / `.env.sample` は判定前に除外する。入力 JSON を parse できない場合は**フェイルオープン**（他層が backstop）

3. ~~**シークレット管理は dotenvx を採用方向とする。**~~ **【[ADR-0040](./0040-defer-secret-at-rest-encryption.md) で取り下げ・見送り】** 以下は当時の記述。`.env` を暗号化 at-rest し `dotenvx run` で実行時注入する。ただし**実 `.env` の暗号化・docker-compose の復号配線は、実シークレットを持つローカル環境での作業**であり、本 ADR では方向決定と runbook 整備にとどめる（実適用は #292 の残タスク）。本リポジトリの `.gitignore` は `**/.env` を無視するため、dotenvx の「暗号化済み `.env` を commit する」モデルとの整合（ファイル名 / ignore 方針）は導入時に確定する。

4. **ADR-0037 を supersede せず拡張する。** 本 ADR は ADR-0037 の役割分担（permissions.deny がシークレット読取を担う）を具体化・強化する位置づけで、方針自体は変更しない。

## Consequences

- `.env.example` / `.env.sample` は Read 可能なまま維持される。変種の網羅は Read deny の列挙 ＋ Bash ガードフックの二層で担保し、Read tool 経由の未列挙変種（例: 独自命名）には残余ギャップがあるが、Bash 層のフックと egress firewall が backstop となる。
- ガードフックは入力 parse 不可時にフェイルオープン（許可）する。フェイルクローズは全 Bash を誤遮断するリスクがあるため避け、Read deny（[ADR-0037](./0037-ai-execution-sandbox-policy.md)）と egress allowlist firewall の多重防御に依存する。
- `.env` トークンを引数に含む正当なコマンドもブロックされる（fail-safe）: `bun --env-file .env` / `git log --grep=.env` / `find -name .env*` / `bun -e 'console.log(process.env.X)'` 等。`process.env.*` アクセスのブロックは、`node -e 'console.log(process.env.LLM_API_KEY)'` のようなスクリプト経由の secret exfiltration（`printenv` 相当）を防ぐ意図もある。アプリ起動は `bun run dev`（Turborepo 経由）や compose を使い、`.env` をシェルに展開しない経路を標準とする。`env VAR=val cmd`（実行形式）は環境ダンプではないためブロック対象外（ALLOW）。
- [ADR-0028](./0028-split-env-infra-and-app.md) で分離したアプリ固有の `apps/api/.env`・`apps/web/.env`（`LLM_API_KEY` 等を所持）も、Read deny の `**/.env` と Bash ガードフックの `.env` トークン検出の両層でカバーされる（パスを問わず一致するため）。
- dotenvx は採用方向だが未導入。平文 `.env` の排除（穴 3 の解消）は #292 の残タスクとしてローカルで実施する想定だった。**この方向は [ADR-0040](./0040-defer-secret-at-rest-encryption.md) で再評価し、見送りとした**（トポロジー上 at-rest 暗号化が二次層にとどまり、git 露出防止の主価値が `.gitignore` ＋ secretlint と冗長なため）。穴 3 は受容残存リスクとし、運用統制（支出上限・専用キー・イベント駆動ローテ）で被害を限定する。現状の保護は Read deny ＋ ガードフック ＋ `.gitignore` ＋ secretlint ＋ egress firewall が構成する。
- **本決定の拡張は別 ADR（[ADR-0040](./0040-defer-secret-at-rest-encryption.md)）で扱う**（CLAUDE.md 規約「意思決定は規模を問わず ADR として残す」に沿い、本 ADR の改訂ではなく新 ADR とする）。ADR-0040 では論点 2 / Decision 3 の dotenvx 採用方向を取り下げた。dotenvx 固有ファイル形式（`.env.vault` 等）は未導入のため deny に含めない（暗号化済みファイルは Read されても実害が小さい）。将来再導入する場合は (1) 暗号化済み `.env` を commit するか（`.gitignore` の `**/.env` との整合）, (2) `DOTENV_PRIVATE_KEY` を持つプロセス内で `printenv` 等から復号後の値が露出し得る抜け道, (3) 固有形式を deny / ガード対象に含めるか、を改めて評価する。
- 既存 deny（`curl` / `wget` / `rm -rf` / force push 等・[ADR-0037](./0037-ai-execution-sandbox-policy.md)）と合わせ、tool 層・Bash 層・OS firewall 層の多重防御を形成する。
- ガードフックの検知対象・意図（ブロック / 許可の境界、偽装・バイパス系の fail-safe トレードオフ）は `.claude/hooks/guard-secret-access.sh` 本体のコメントに記述している。regex 変更時はそのコメントを基準に手元で挙動を確認する（専用テスト harness は二次防御の局所ツールとしては過剰なため設けない）。
- `docs/guides/env.md` にシークレット保護セクションを追加し、`docs/guides/ai-driven-development.md` の施策インベントリ（permissions / hooks 行）を本決定に合わせて更新する。
