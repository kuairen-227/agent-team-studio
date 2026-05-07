# コード可読性原則

本プロジェクトのコード実装に貫く可読性・シンプルさの判定軸の SSoT。横断軸の俯瞰は [principles/README.md](./README.md) に戻る。領域固有の評価基準（型安全性・依存方向・モジュール境界等）は [.claude/agents/architect.md](../../.claude/agents/architect.md) に残す。TypeScript 固有の JSDoc/TSDoc 方針は [.claude/rules/typescript.md](../../.claude/rules/typescript.md) を参照する。

## 第 1 部 可読性の判定軸

### 1. 命名——名前が意図を語る

名前は「何をするか」ではなく「何のためか」を語る。

- 省略形は業界慣習のみ許容する（`err`, `ctx`, `i` など。`tmp`, `data`, `obj` は却下）
- boolean 変数は `is` / `has` / `can` プレフィックスで状態を明示する
- 条件式が複雑なら名前付き変数に抽出して意図を表す

```ts
// NG
if (u.r === 'admin' && u.s !== 2) { ... }

// OK
const isAdminWithActiveSession = user.role === 'admin' && user.status !== SessionStatus.Expired;
if (isAdminWithActiveSession) { ... }
```

### 2. 関数サイズ——一画面に収める

目安は 30 行以内（コメント・空行除く）。超えたら分割を検討する。

- 判断基準は行数ではなく「一つのことをしているか」。行数は副産物として見る
- 分割の妥当性はテスト容易性で確認する（単体でテストが書けるなら適切な分割）

### 3. ネスト深度——ガード節で happy path を守る

ネスト 3 段以上はリファクタリングのシグナル。

- ガード節（early return）で異常系を先に弾く
- 三項演算子の多段ネストは `if` に戻す
- ネストした `map` / `filter` はヘルパー関数か変数に抽出する

```ts
// NG
function process(user: User | null) {
  if (user) {
    if (user.isActive) {
      if (user.role === 'admin') {
        return doSomething(user);
      }
    }
  }
}

// OK
function process(user: User | null) {
  if (!user) return;
  if (!user.isActive) return;
  if (user.role !== 'admin') return;
  return doSomething(user);
}
```

### 4. コメント——「なぜ」だけを書く

コードが「何をするか」を語る。コメントは「なぜそうなのか」を書く。

- ビジネスルール・制約の根拠・非自明な ADR 参照はコメントとして価値がある
- 「何をするか」の説明（`// ユーザーを取得する`）は不要
- 死んだコードをコメントアウトで残さない（git log で十分）

### 5. 型で意図を伝える

TypeScript の型はドキュメントとして機能する。型名に意図を乗せる。

- `string` より `UserId`、`number` より `TemplateVersion` など、ドメイン語彙を型に使う
- `boolean` フラグの羅列より discriminated union で状態を表現する
- `any` / `as` の扱いは [architect.md](../../.claude/agents/architect.md) の既存ルールに従う

### 6. 複雑度の削減

1 関数あたりの条件分岐を 5 以下に抑えることを目安とする。

- 条件式は名前付き変数に抽出して意図を明示する（§1 と連動）
- ネストしたループはコレクション操作（`filter` / `map` / `reduce`）で書き直す
- 複数の `if-else` が同じ変数を分岐するなら `switch` か lookup map を検討する

## 第 2 部 採用する業界標準

| 標準 | 本ドキュメントでの参照箇所 |
| --- | --- |
| Clean Code (Robert C. Martin) | §1 命名・§2 関数サイズ・§4 コメント |
| Cognitive Complexity (SonarSource) | §3 ネスト深度・§6 複雑度 |

## 第 3 部 横断的アンチパターン

| # | アンチパターン | 該当軸 |
| --- | --- | --- |
| 1 | 意図なき省略名（`tmp`, `data`, `obj`, `res`） | §1 |
| 2 | 「何をするか」コメント（`// ユーザーを取得する`） | §4 |
| 3 | 死んだコードのコメントアウト | §4 |
| 4 | ネスト 3 段以上の if チェーン（ガード節で解消できる） | §3, §6 |
| 5 | フラグ引数（`process(user, true, false)`） | §1, §6 |
| 6 | 30 行超かつ複数の責務を持つ関数 | §2 |
