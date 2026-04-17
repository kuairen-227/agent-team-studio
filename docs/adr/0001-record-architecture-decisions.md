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

Nygard 原則に従い、Consequences は**決定を適用した後の結果のコンテキスト**を記述する。ポジティブ・ネガティブ・中立のすべてを列挙する。

- ネガティブ項には、影響の所在や後続 Issue / バージョンへの参照を添えてよい（例: `（#N で対応）`、`（v2 で追加）`）
- ただし、詳細な対策手順や実装方針は Consequences に書かず、Decision セクションまたは後続 Issue で扱う
