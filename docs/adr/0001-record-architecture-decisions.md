# 0001. ADR を用いてアーキテクチャの意思決定を記録する

## Status

accepted

- 作成日: 2026-04-17

## Context

このプロジェクトでは AI と協働して開発を進めるため、意思決定の経緯を明示的に記録しておくことが重要である。コードだけでは「なぜその選択をしたか」が失われやすく、後から振り返った際に判断の根拠がわからなくなる。

## Decision

Michael Nygard の軽量 ADR フォーマット（Title / Status / Context / Decision / Consequences）を採用し、`docs/adr/` ディレクトリで管理する。

## Consequences

- アーキテクチャに関わる決定の背景と理由が追跡可能になる
- ADR を書く手間が増えるが、軽量フォーマットのため負荷は最小限
- 軽微な決定は `docs/decisions/` の意思決定ログに記録し、ADR は重要な決定に限定する

### Consequences の記述規約

Nygard 原則に従い、Consequences は**決定の結果として生じる事象の中立的記述**に徹める。リスク緩和策や追加アクション（`→ 対策:` 等）は Consequences に書かない。

- **既に決定済みの緩和策** → Decision セクションに記述する（決定の一部であるため）
- **未決定・後続で扱う緩和策** → 後続 Issue / ADR への参照に留める（例: `#N で扱う`）
