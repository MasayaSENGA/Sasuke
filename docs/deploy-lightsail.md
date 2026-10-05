# Amazon Lightsail へのデプロイ手順

Lightsail のインスタンス (Ubuntu) 上で Docker Compose を使って動かす。

```
インターネット ──(HTTPS)──▶ caddy (80/443) ──▶ app (Next.js :3000) ──▶ SQLite (sasuke-data ボリューム)
                                                 └──▶ SwitchBot API
```

- **caddy**: Let's Encrypt の証明書を自動で取得・更新するリバースプロキシ
- **migrate**: 起動のたびに DB マイグレーションを適用して終了するコンテナ
- **app**: Next.js 本体 (standalone ビルド)。DB は Docker ボリュームに保存されるので、コンテナを作り直しても消えない

> Lightsail の「コンテナサービス」はストレージが永続化されないため、SQLite を使うこの構成では **インスタンス** を使う。

## 前提

- 独自ドメイン (またはサブドメイン) を 1 つ用意できること。HTTPS に必要
  - 例: `home.example.com`。DuckDNS などの無料ダイナミック DNS でも可
- このリポジトリをサーバーから `git clone` できること (非公開リポジトリならデプロイキーを登録する)

## 0. (任意) 手元で本番構成を試す

Docker Desktop があれば、Lightsail に上げる前に同じ構成を手元で確認できる。`DOMAIN="localhost"` にすると Caddy が自己署名証明書で HTTPS を提供する (ブラウザの警告は許可して進む)。

```bash
cp .env.production.example .env.production
# DOMAIN="localhost"、BETTER_AUTH_URL="https://localhost"、ALLOW_SIGNUP="true" にし、シークレット 2 つを生成して記入
docker compose -p sasuke-local up -d --build
open https://localhost
# 終わったら片付け (-v で DB も削除)
docker compose -p sasuke-local down -v
rm .env.production
```

## 1. インスタンスの作成

1. Lightsail コンソール → インスタンスの作成
   - プラットフォーム: Linux/Unix、ブループリント: OS のみ → **Ubuntu 24.04 LTS**
   - プラン: **メモリ 2 GB 以上を推奨** (Next.js のビルドにメモリを使うため。1 GB の場合は後述のスワップを追加)
2. ネットワーキング → **静的 IP を作成** してインスタンスにアタッチ
3. ネットワーキング → IPv4 ファイアウォールに以下を追加 (IPv6 も同様)
   - HTTP (TCP 80) ※証明書の取得に必要
   - HTTPS (TCP 443)
   - (任意) カスタム UDP 443 ※HTTP/3 用
4. DNS で、ドメインの **A レコード** を静的 IP に向ける

## 2. サーバーの準備

SSH で接続して実行する (Lightsail コンソールのブラウザ SSH でも可)。

```bash
# Docker のインストール (公式リポジトリから)
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# sudo なしで docker を使えるようにする (再ログイン後に有効)
sudo usermod -aG docker $USER
```

メモリ 1 GB のプランの場合はスワップを追加しておく。

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. アプリの配置と設定

```bash
git clone https://github.com/MasayaSENGA/Sasuke.git sasuke
cd sasuke
cp .env.production.example .env.production
openssl rand -base64 32   # BETTER_AUTH_SECRET 用
openssl rand -base64 32   # ENCRYPTION_KEY 用
nano .env.production
```

`.env.production` に以下を設定する。

| 変数 | 内容 |
| --- | --- |
| `DOMAIN` | 公開するドメイン (例: `home.example.com`) |
| `BETTER_AUTH_URL` | `https://` + ドメイン |
| `BETTER_AUTH_SECRET` | 生成したランダム値 (開発環境とは別の値) |
| `ENCRYPTION_KEY` | 生成したランダム値。**変更すると保存済みの SwitchBot トークンが復号できなくなる** ので、控えを安全な場所に保管する |
| `ALLOW_SIGNUP` | 最初は `true` (自分のアカウントを作るため) |

## 4. 起動

```bash
docker compose up -d --build
docker compose ps          # app が healthy、migrate が exited (0) になっていれば OK
docker compose logs -f app # ログ確認 (Ctrl+C で抜ける)
```

`https://{DOMAIN}` を開き、アカウントを作成 → 設定画面で SwitchBot のトークンを登録する。

**自分のアカウントを作ったら、必ず新規登録を止める。**

```bash
sed -i 's/^ALLOW_SIGNUP=.*/ALLOW_SIGNUP="false"/' .env.production
docker compose up -d
```

## 更新 (新しいコードを反映する)

```bash
cd ~/sasuke
git pull
docker compose up -d --build   # マイグレーションも自動で適用される
docker image prune -f          # 古いイメージを削除
```

## バックアップ

- **おすすめ**: Lightsail コンソール → インスタンス → スナップショット → **自動スナップショットを有効化** (毎日インスタンス丸ごと保存)
- DB ファイルだけを取り出す場合 (一時的にアプリを止めて整合性を保つ):

```bash
docker compose stop app
docker run --rm -v sasuke_sasuke-data:/data -v "$PWD":/backup alpine cp /data/sasuke.db /backup/sasuke-$(date +%Y%m%d).db
docker compose start app
```

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| HTTPS でつながらない | DNS が静的 IP を向いているか (`dig +short ドメイン`)、ファイアウォールで 80/443 が開いているか、`docker compose logs caddy` |
| ログインできない / すぐログアウトされる | `BETTER_AUTH_URL` がブラウザで開いている URL と完全に一致しているか (`https://`、末尾スラッシュなし) |
| SwitchBot のトークンが無効と言われる | `ENCRYPTION_KEY` を変更していないか。変更した場合は設定画面でトークンを登録し直す |
| ビルド中に止まる / 落ちる | メモリ不足。プランを上げるかスワップを追加する |
