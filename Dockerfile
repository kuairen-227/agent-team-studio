FROM mcr.microsoft.com/devcontainers/javascript-node:24

# claude-home named volume の初回マウント時、Docker は image 内マウント先ディレクトリの
# 所有権を volume にコピーする。事前に /home/node/.claude を node 所有で作っておくことで、
# 初回マウントが node:node となり claude login が認証情報を保存できるようにする。
# （ディレクトリが存在しない場合は volume が root:root で作られ、node ユーザーから書き込めない）
USER root
RUN mkdir -p /home/node/.claude && chown node:node /home/node/.claude

# egress allowlist firewall（ADR-0037 + ADR-0041 / .devcontainer/init-firewall.sh）が使うツール群。
# nftables = ルール本体（inet ファミリで v4/v6 統合・atomic load。ipset はネイティブ set で不要）,
# dnsutils = dig（ドメイン解決）, aggregate = CIDR 集約, jq = GitHub meta 解析。
# スクリプト自体は image に焼き込まず、postStartCommand がワークスペースの実体を直接実行する
# （image COPY 方式は .dockerignore の再包含・ビルドキャッシュ・パス所有権の問題で実体が差し替わる
#  事故が起きたため見送り。bind mount された実ファイルを走らせる方が確実。詳細は ADR-0037）。
RUN apt-get update \
    && apt-get install -y --no-install-recommends nftables dnsutils aggregate jq \
    && rm -rf /var/lib/apt/lists/*
USER node
