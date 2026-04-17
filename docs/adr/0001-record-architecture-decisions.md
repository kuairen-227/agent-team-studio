# 0001. ADR を用いてアーキテクチャの意思決定を記録する

## Status

accepted

## Context

このプロジェクトでは AI と協働して開発を進めるため、意思決定の経緯を明示的に記録しておくことが重要である。コードだけでは「なぜその選択をしたか」が失われやすく、後から振り返った際に判断の根拠がわからなくなる。

## Decision

Michael Nygard の軽量 ADR フォーマット（Title / Status / Context / Decision / Consequences）を採用し、`docs/adr/` ディレクトリで管理する。

## Consequences

- アーキテクチャに関わる決定の背景と理由が追跡可能になる
- ADR を書く手間が増えるが、軽量フォーマットのため負荷は最小限
- 軽微な決定は `docs/decisions/` の意思決定ログに記録し、ADR は重要な決定に限定する
