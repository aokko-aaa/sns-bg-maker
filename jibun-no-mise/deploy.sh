#!/usr/bin/env bash
# 「じぶんの店」を公開して、本当に世界から見えるところまで確かめる。
#
# 罠帖 G-5「pushしただけでは本番が変わらない」への対処として、
# ビルド不要のこのサイトでも「deploy → 疎通」を一続きの型にしてある。
#
# 使い方:
#   ./deploy.sh              # デプロイして、払い出されたURLで検証
#   ./deploy.sh https://…    # 独自ドメイン等、検証先を明示したいとき（罠帖 A-2）

set -euo pipefail
cd "$(dirname "$0")"

WRANGLER="npx wrangler"
EXPECTED="ただいま開店準備中です。"

echo "==> 認証の確認"
# 罠帖 J-2: 認証切れは自分では直せない。粘らず、その場で人間に依頼する。
if ! $WRANGLER whoami 2>&1 | grep -q 'Account Name\|account_id'; then
  echo "!! Cloudflareにログインしていません。'npx wrangler login' を実行してから再度どうぞ。" >&2
  exit 1
fi

echo "==> デプロイ"
log=$(mktemp)
trap 'rm -f "$log"' EXIT
$WRANGLER deploy 2>&1 | tee "$log"

url="${1:-}"
if [ -z "$url" ]; then
  url=$(grep -oE 'https://[A-Za-z0-9.-]+\.workers\.dev' "$log" | head -1 || true)
fi
if [ -z "$url" ]; then
  echo "!! 検証先URLを特定できませんでした。'./deploy.sh <URL>' で指定してください。" >&2
  exit 1
fi

echo
echo "==> 疎通の確認: $url"
# 罠帖 A-1: 公開直後は世界中の配達拠点に行き渡るまで数秒〜十数秒のずれがある。
# 1回目の404やエラーで即断せず、間を置いて数回試す。
for attempt in 1 2 3 4 5; do
  sleep 5
  body=$(mktemp)
  code=$(curl -sS -o "$body" -w '%{http_code}' "$url" || echo "000")
  if [ "$code" = "200" ] && grep -qF "$EXPECTED" "$body"; then
    rm -f "$body"
    echo "   OK ($attempt回目): 200 / 「$EXPECTED」を確認"
    echo
    echo "公開できました: $url"
    exit 0
  fi
  rm -f "$body"
  echo "   …$attempt回目: HTTP $code（まだ行き渡っていない可能性あり。再試行します）"
done

echo "!! 5回試しても期待した内容を確認できませんでした: $url" >&2
echo "   ログの確認: $WRANGLER tail --format json > tail.log  （罠帖 A-14）" >&2
exit 1
