# テスト原則

本プロジェクトのテスト設計・テストコードに貫く領域横断的な判断軸の SSoT。横断軸の俯瞰は [principles/README.md](./README.md) に戻る。領域固有の評価基準・具体例（ISTQB 技法・mock 戦略・error handling 等）は [.claude/agents/qa.md](../../.claude/agents/qa.md) に残す（[ADR-0011](../adr/0011-role-based-agent-architecture.md), [ADR-0017](../adr/0017-design-development-principles.md), [ADR-0019](../adr/0019-split-principles-by-topic.md)）。

採用フローは [ADR-0010（型駆動 + 軽量 TDD）](../adr/0010-development-workflow.md) と [development-workflow.md](../guides/development-workflow.md) を SSoT とする。本書は「価値あるテストとは何か」の判定軸を扱う。

## 第 1 部 価値あるテストの判定軸

### 1. 振る舞いを検証し、実装詳細・定義の写経は避ける

テストは「外部から観測可能な振る舞い（入力 → 出力 / 状態遷移 / 副作用）」を検証する。内部の関数呼び出し順序・private な構造・型定義の機械的な写経は避ける。

- 振る舞いに変化がない健全なリファクタでテストが落ちるなら、実装詳細を見ている疑いが強い
- 型定義そのものを実行時アサーションに写し直すテストは、TypeScript の型検査が既に保証しており冗長

### 2. 入力と期待値の経路独立性（第三者検証）

テストが欠陥検出装置として機能するには、入力（Arrange / Act）と期待値（Assert）が**独立した経路**で得られている必要がある。両辺が同じソース（同じ定数・同じ関数の出力・同じ生成ロジック）から導出されると**トートロジーテスト**になり、開発者の値変更がそのまま期待値の書き換えで通ってしまう。

- 入力にプロダクションの SSoT を使うなら、期待値はハードコードリテラル等の独立経路で書く
- 期待値の生成にプロダクションコードを呼ばない（テストヘルパで生成する場合は、テストファイル内で完結する独立な実装にする）

### 3. 「テストを書かない」判断の正当化ライン

テストの書き手は「書く / 書かない」の双方の判断責任を持つ。以下のいずれかに該当する場合、テストを書かないことが正当化される:

- **コスト > 価値**: 検出したい欠陥が現実的に発生し得ない、または手動確認・型検査・lint で十分捕捉できる
- **自明な型同義**: TypeScript の型で既に保証されている性質（例: `as const` 配列の要素列挙）の写経
- **不変な定義の写経**: 値が変わったら期待値も同じ手で書き換わる構造（経路独立性 §2 を満たさない）
- **MVP 外の層**: ADR-0010 で MVP では見送りと決めた層（例: E2E）の自動化を新たに作らない

書かない判断は PR 説明やテストコードのコメントに根拠を残す（誠実さ: principles/README.md §5）。

## 第 2 部 採用する業界標準（用語と体系）

定義は重複させない。本節は本プロジェクトで採用する用語の見取り図と帰属を示す。深掘りは脚注の出典を参照する。

### 構造パターン

- **AAA（Arrange-Act-Assert）**: テストコード本体の物理構造（準備 / 実行 / 検証の 3 ブロック）[^aaa]
- **Given-When-Then**: 仕様記述の意味構造（BDD framing）。本プロジェクトでは `describe`/`it` のテキストに採用する（[ADR-0010 §3](../adr/0010-development-workflow.md)）。Cucumber 等の Gherkin フレームワークは導入しない
- 両者は粒度が異なり共存する（Given ≈ Arrange / When ≈ Act / Then ≈ Assert）。AAA でコードを分け、describe/it に GWT 語彙を使う併用が標準

### FIRST 原則

ユニットテストが満たすべき性質[^first]:

- **Fast**: 高速に実行できる（数ミリ秒〜数百ミリ秒）
- **Independent**: テスト同士が依存しない・実行順に依存しない
- **Repeatable**: 環境を選ばず同じ結果が得られる
- **Self-validating**: pass / fail が自動判定される（人間の目視確認に依存しない）
- **Timely**: 実装の直前〜直後に書く（軽量 TDD）

### Test Pyramid

unit / integration / e2e の比率設計の指針[^pyramid]。下層（unit）を厚く、上層（e2e）を薄くする。本プロジェクトの現状:

| 層 | 配分 | 備考 |
| --- | --- | --- |
| unit | 厚い | Service 層必須（[development-workflow.md](../guides/development-workflow.md)） |
| integration | 中程度 | Route 層で `app.request()` 結合、co-location |
| e2e | MVP では見送り | 画面 3 つ、手動確認で十分（[ADR-0010](../adr/0010-development-workflow.md)） |

### 振る舞い検証 vs 実装詳細検証

**Behavior testing**: 公開された API・観測可能な状態変化を検証する。リファクタに耐える。
**Implementation testing**: 内部メソッドの呼び出し順序・private 状態を検証する。リファクタで壊れる。
本プロジェクトでは behavior 寄りを既定とする（§1）。

### Test Doubles（Meszaros 分類）

外部依存を置き換える「テスト用代役」の総称[^doubles]。混同を避けるため用語を区別する:

| 種類 | 役割 |
| --- | --- |
| **Dummy** | 渡すだけで使われない値（プレースホルダ） |
| **Stub** | 決まった応答を返す（状態検証） |
| **Spy** | 呼び出しを記録する（事後の検証用） |
| **Mock** | 期待される呼び出しを事前に設定し、不一致で fail（振る舞い検証） |
| **Fake** | 簡易版の実装（in-memory DB 等） |

「mock」を総称として使わず、用途に応じて使い分ける。**外部依存以外までモックしない**（§3 アンチパターン参照）。

### Test Smells

典型的な悪臭パターン[^smells]:

- **Tautology Test**: 入力と期待値が同じソース由来で第三者検証になっていない
- **Fragile Test**: 振る舞いに無関係な変更で壊れる（実装詳細依存）
- **Mystery Guest**: テストが外部ファイル・グローバル状態に依存し、テスト単体で挙動が読めない
- **Eager Test**: 1 テストで複数の振る舞いをまとめて検証し、失敗時に原因が特定できない
- **Test Code Duplication**: 似た準備コードを各テストで複製し、修正コストが増す

### 採用しない概念と理由

| 概念 | 採用しない理由 |
| --- | --- |
| Mutation Testing | MVP 段階では実行コストが価値を上回る。将来 Service 層の品質計測が必要になった時点で再検討 |
| Property-Based Testing（fast-check 等） | ドメインが小さく不変条件が乏しい。導入する場面が出てきたら個別に判断 |
| Cucumber / Gherkin | BDD framing は採用するがフレームワークは過剰（[ADR-0010 §3](../adr/0010-development-workflow.md)） |
| Snapshot Testing（UI 以外） | 期待値が機械生成され第三者検証にならない（§1.2 違反）。UI レンダリング検証は MVP で見送り |

## 第 3 部 横断的アンチパターン

領域固有の具体例（カバレッジ追求の qa 観点・テストデータ命名等）は [.claude/agents/qa.md](../../.claude/agents/qa.md) に残す。本節は横断的なものを置く。

| # | アンチパターン | 該当軸 |
| --- | --- | --- |
| 1 | **トートロジーテスト** — 入力と期待値が同じソース由来。第三者検証になっておらず欠陥検出装置として機能しない | §1.2 |
| 2 | **実装詳細のテスト** — 内部メソッドの呼び出し順序・private 状態を検証し、リファクタで壊れる | §1.1, §2 |
| 3 | **過剰モック** — 外部依存以外までモックし、テストがコードの構造をなぞるだけになる | §1.1, §2 |
| 4 | **カバレッジ数値追求** — 数値を上げるためだけの意味のないテストを書く | §1.3, principles/README.md §3 |
| 5 | **型定義の写経** — TypeScript の型で保証済みの性質を実行時アサーションで再確認する | §1.1, §1.3 |
| 6 | **Mystery Guest** — テストが外部ファイル・グローバル状態に依存し、単体で挙動が読めない | §2 |
| 7 | **Eager Test** — 1 テストで複数の振る舞いをまとめて検証し、失敗時に原因が特定できない | §2 |

## 関連

- [principles/README.md](./README.md): 横断軸の俯瞰
- [ADR-0010](../adr/0010-development-workflow.md): 型駆動 + 軽量 TDD
- [ADR-0011](../adr/0011-role-based-agent-architecture.md): エージェント = 専門知識の領域
- [ADR-0017](../adr/0017-design-development-principles.md): 設計・開発原則ドキュメントの新設
- [ADR-0019](../adr/0019-split-principles-by-topic.md): principles の主題別分割
- [.claude/agents/qa.md](../../.claude/agents/qa.md): QA 領域固有の評価基準
- [development-workflow.md](../guides/development-workflow.md): 実装ワークフロー

[^aaa]: Bill Wake, "3A – Arrange, Act, Assert" (2001). xUnit Patterns では "Four-Phase Test"（Setup-Exercise-Verify-Teardown）として体系化されている（Gerard Meszaros, *xUnit Test Patterns*, 2007）
[^first]: Robert C. Martin, *Clean Code* (2008), Chapter 9
[^pyramid]: Mike Cohn, *Succeeding with Agile* (2009)。Martin Fowler "TestPyramid" (2012, <https://martinfowler.com/bliki/TestPyramid.html>) で広く知られる
[^doubles]: Gerard Meszaros, *xUnit Test Patterns* (2007)。Martin Fowler "TestDouble" (2006, <https://martinfowler.com/bliki/TestDouble.html>)
[^smells]: Gerard Meszaros, *xUnit Test Patterns* (2007), Part III "Test Smells"
