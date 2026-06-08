FROM mcr.microsoft.com/devcontainers/javascript-node:24

# claude-home named volume の初回マウント時、Docker は image 内マウント先ディレクトリの
# 所有権を volume にコピーする。事前に /home/node/.claude を node 所有で作っておくことで、
# 初回マウントが node:node となり claude login が認証情報を保存できるようにする。
# （ディレクトリが存在しない場合は volume が root:root で作られ、node ユーザーから書き込めない）
USER root
RUN mkdir -p /home/node/.claude && chown node:node /home/node/.claude

# egress allowlist firewall（ADR-0036 / .devcontainer/init-firewall.sh）が使うツール群。
# iptables / ipset = ルール本体, dnsutils = dig（ドメイン解決）, aggregate = CIDR 集約, jq = GitHub meta 解析。
RUN apt-get update \
    && apt-get install -y --no-install-recommends iptables ipset dnsutils aggregate jq \
    && rm -rf /var/lib/apt/lists/*
USER node
