# 自宅 Windows サーバー + Cloudflare Tunnel でのデプロイ手順

自宅の Windows PC 上で Docker Desktop を使って動かし、Cloudflare Tunnel でインターネットに公開する。

```
インターネット ──(HTTPS)──▶ Cloudflare ◀──(トンネル: 自宅から外向きに接続)── cloudflared ──▶ app (Next.js :3000) ──▶ SQLite (sasuke-data ボリューム)
                                                                                              └──▶ SwitchBot API
```

- **cloudflared**: 自宅から Cloudflare へ外向きに接続し、届いたリクエストを app に中継する。**ルーターのポート開放・固定 IP・証明書の管理はいずれも不要**
- **migrate**: 起動のたびに DB マイグレーションを適用して終了するコンテナ
- **app**: Next.js 本体 (standalone ビルド)。DB は Docker ボリュームに保存されるので、コンテナを作り直しても消えない

構成は `compose.tunnel.yaml`。Lightsail 用の `compose.yaml` (Caddy) は使わない。

## 前提

- 公開に使うドメインが **Cloudflare で DNS 管理されている** こと (ネームサーバーが Cloudflare)
  - 公開するのは `sasuke.example.jp` のような **1 階層のサブドメイン** にする。`a.b.example.jp` のような 2 階層は Cloudflare の無料証明書の対象外
- Windows 10/11 (64bit、Pro/Home どちらでも可)。メモリ 8 GB 以上推奨 (Docker Desktop と Next.js のビルドで使う)
- このリポジトリを `git clone` できること

## 1. Windows の準備

### Docker Desktop と Git のインストール

PowerShell (管理者) で実行する。

```powershell
wsl --install
winget install -e --id Docker.DockerDesktop
winget install -e --id Git.Git
```

再起動後に Docker Desktop を起動し、以下を設定する。

- Settings → General → **Start Docker Desktop when you sign in to your computer** をオン
- Settings → General → **Use the WSL 2 based engine** がオンになっていること

`docker version` が Server の情報まで表示されれば OK。

### 常時稼働のための設定

Docker Desktop は **Windows にサインインしている間だけ** 動く。停電や Windows Update で再起動したあとも自動で復帰するよう、以下を設定しておく。

| 設定 | 場所 |
| --- | --- |
| スリープしない | 設定 → システム → 電源 → 画面とスリープ → スリープ「なし」 |
| 再起動後に自動サインイン | [Sysinternals Autologon](https://learn.microsoft.com/sysinternals/downloads/autologon) で設定 (パスワードは暗号化して保存される) |
| 再起動の時間帯を制限 | 設定 → Windows Update → 詳細オプション → アクティブ時間 |
| 停電からの復帰 (任意) | BIOS/UEFI の「AC Power Recovery / Restore on AC Power Loss」を「Power On」 |

> 自動サインインを使う場合は、PC を物理的に触れる人が限られる場所に置く。画面はロックしておいてよい (`Win + L` してもコンテナは動き続ける)。

## 2. Cloudflare Tunnel の作成

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) → **Zero Trust** → Networks → **Tunnels** → **Create a tunnel**
   - 初めて Zero Trust を開くとチーム名とプランの選択を求められる。**Free プラン** で足りる (支払い情報の登録を求められる場合がある)
2. コネクタの種類は **Cloudflared**、トンネル名は `sasuke` など任意
3. 環境の選択で **Docker** を選ぶと `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJ...` というコマンドが表示される
   - **`--token` の後ろの文字列 (eyJ で始まる長い値) だけ** を控える。コマンド自体は実行しない (compose で起動するため)
4. 次の画面で公開するホスト名 (Public hostname / Published application) を追加する

| 項目 | 値 |
| --- | --- |
| Subdomain | 例: `sasuke` |
| Domain | Cloudflare で管理しているドメイン |
| Path | 空欄 |
| Service Type | **HTTP** |
| URL | **`app:3000`** (compose 内のサービス名。`localhost` ではない) |

保存すると、そのホスト名の DNS レコード (CNAME → `<トンネルID>.cfargotunnel.com`) が自動で作られる。

> **同じホスト名の A レコードが既にあるとエラーになる。** Lightsail から移行する場合などは、先に DNS 画面から既存の A レコードを削除する (移行手順は後述)。

### Cloudflare 側のおすすめ設定

| 設定 | 場所 | 値 |
| --- | --- | --- |
| 常に HTTPS を使用 | SSL/TLS → Edge Certificates | オン (http:// のアクセスを https:// に転送) |
| 最小 TLS バージョン | SSL/TLS → Edge Certificates | 1.2 |

SSL/TLS の暗号化モード (フレキシブル / フル など) は、トンネル経由の通信には影響しないので変更不要。

## 3. アプリの配置と設定

PowerShell (通常ユーザー) で実行する。

```powershell
git clone https://github.com/MasayaSENGA/Sasuke.git C:\sasuke
cd C:\sasuke
Copy-Item .env.production.example .env.production
```

シークレットを 2 つ生成する (1 回ずつ実行して別々の値を使う)。

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

`notepad .env.production` で以下を設定する。

| 変数 | 内容 |
| --- | --- |
| `TUNNEL_TOKEN` | 手順 2 で控えたトークン (行頭の `#` を外す) |
| `BETTER_AUTH_URL` | `https://` + 公開するホスト名 (例: `https://sasuke.example.jp`、末尾スラッシュなし) |
| `BETTER_AUTH_SECRET` | 生成したランダム値 (開発環境とは別の値) |
| `ENCRYPTION_KEY` | 生成したランダム値。**変更すると保存済みの SwitchBot トークンが復号できなくなる** ので、控えを安全な場所に保管する |
| `ALLOW_SIGNUP` | 最初は `true` (自分のアカウントを作るため) |

`DOMAIN` は Caddy 用なので、この構成では使わない (残しておいても害はない)。

> `TUNNEL_TOKEN` はトンネルを乗っ取れる値なので、`.env.production` を Git に含めたり人に渡したりしない (`.gitignore` 済み)。

## 4. 起動

```powershell
docker compose -f compose.tunnel.yaml up -d --build
docker compose -f compose.tunnel.yaml ps            # app が healthy、cloudflared が Up になっていれば OK
docker compose -f compose.tunnel.yaml logs -f cloudflared   # "Registered tunnel connection" が出ていれば接続済み (Ctrl+C で抜ける)
```

Cloudflare の Tunnels 画面でも、トンネルの状態が **HEALTHY** になる。

`https://{ホスト名}` を開き、アカウントを作成 → 設定画面で SwitchBot のトークンを登録する。

リアルタイム更新を使う場合は、設定画面の「リアルタイム更新 (Webhook)」で有効化する。

**自分のアカウントを作ったら、必ず新規登録を止める。** `.env.production` の `ALLOW_SIGNUP` を `"false"` にして、以下を実行する。

```powershell
docker compose -f compose.tunnel.yaml up -d
```

> 毎回 `-f compose.tunnel.yaml` を付けるのが面倒なら、`[Environment]::SetEnvironmentVariable("COMPOSE_FILE", "compose.tunnel.yaml", "User")` を一度実行して PowerShell を開き直すと、`docker compose up -d` だけで済む。

すべてのコンテナは `restart: unless-stopped` なので、Docker Desktop が起動すれば自動で立ち上がる。

## 更新 (新しいコードを反映する)

```powershell
cd C:\sasuke
git pull
docker compose -f compose.tunnel.yaml pull cloudflared   # cloudflared の更新
docker compose -f compose.tunnel.yaml up -d --build      # マイグレーションも自動で適用される
docker image prune -f                                    # 古いイメージを削除
```

## バックアップ

DB ファイルを取り出す (一時的にアプリを止めて整合性を保つ)。

```powershell
cd C:\sasuke
docker compose -f compose.tunnel.yaml stop app
docker run --rm -v sasuke_sasuke-data:/data -v "${PWD}:/backup" alpine cp /data/sasuke.db "/backup/sasuke-$(Get-Date -Format yyyyMMdd).db"
docker compose -f compose.tunnel.yaml start app
```

できた `sasuke-YYYYMMDD.db` を OneDrive や NAS など **別の場所** にコピーしておく。`.env.production` (特に `ENCRYPTION_KEY`) も一緒に保管しないと、復元しても SwitchBot トークンを読み出せない。

定期的に取りたい場合は、上記を `.ps1` にしてタスク スケジューラに登録する。

## Lightsail からの移行

ドメインを変えずに移す場合の手順。DB と `ENCRYPTION_KEY` を引き継げば、アカウントや SwitchBot の設定はそのまま使える。

1. **Lightsail 側**: [Lightsail 手順のバックアップ](deploy-lightsail.md#バックアップ) で `sasuke-YYYYMMDD.db` を作り、`.env.production` と一緒に手元へコピーする (`scp` や Lightsail のブラウザ SSH のダウンロード機能など)
2. **Windows 側**: 手順 1〜3 を進める。ただし `BETTER_AUTH_SECRET` と `ENCRYPTION_KEY` は **Lightsail の値をそのまま** 使う
3. コピーした DB をボリュームに入れる (`sasuke-YYYYMMDD.db` を `C:\sasuke` に置いた状態で)

   ```powershell
   docker volume create sasuke_sasuke-data
   docker run --rm -v sasuke_sasuke-data:/data -v "${PWD}:/backup" alpine sh -c "cp /backup/sasuke-YYYYMMDD.db /data/sasuke.db && chown -R 1000:1000 /data"
   ```

4. Cloudflare の DNS 画面で、Lightsail を向いている **A レコードを削除** してから、手順 2 のホスト名を追加する
5. 手順 4 で起動し、ログインできること・ダッシュボードが表示されることを確認する
6. Webhook はドメインが同じなら登録し直す必要はない (URL も秘密文字列も DB ごと引き継がれる)。リアルタイム更新が届くことだけ確認する
   - ドメインを変える場合は、移行前に Lightsail 側の設定画面で Webhook を無効にし、移行後に新しい環境で有効にし直す
7. 問題なければ Lightsail のインスタンスを停止し、しばらく様子を見てから削除する (静的 IP も解放する。アタッチされていない静的 IP は課金される)

## (任意) Cloudflare Access でさらに守る

Zero Trust → Access → Applications でホスト名を登録すると、アプリのログイン画面の手前で Cloudflare による認証 (メールのワンタイムコード等) を挟める。

その場合、**SwitchBot からの Webhook は認証できないので、パス `/api/webhooks/` を対象外 (Bypass) にする** こと。忘れるとリアルタイム更新が届かなくなる。

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| ページが開けない (Cloudflare のエラー 1033) | トンネルが接続されていない。`docker compose -f compose.tunnel.yaml logs cloudflared`、`TUNNEL_TOKEN` が正しいか |
| Cloudflare の 502 / 503 エラー | トンネル設定の URL が `app:3000` (HTTP) になっているか。`docker compose -f compose.tunnel.yaml ps` で app が healthy か |
| ホスト名の追加時に「レコードが既に存在する」 | DNS 画面で同じ名前の A / CNAME レコードを削除してから追加し直す |
| ログインできない / すぐログアウトされる | `BETTER_AUTH_URL` がブラウザで開いている URL と完全に一致しているか (`https://`、末尾スラッシュなし) |
| SwitchBot のトークンが無効と言われる | `ENCRYPTION_KEY` を変更していないか。変更した場合は設定画面でトークンを登録し直す |
| リアルタイム更新が反映されない | 設定画面で有効になっているか。Cloudflare の Security → Events で `/api/webhooks/` がブロックされていないか (Bot Fight Mode や WAF、Access が原因になりうる。ブロックされていたらそのパスを除外するルールを追加) |
| 再起動後にサイトが落ちたまま | Windows に自動サインインできているか、Docker Desktop が自動起動しているか |
| ビルド中に止まる / 落ちる | メモリ不足。Docker Desktop → Settings → Resources で割り当てを増やす (WSL 2 の場合は `%UserProfile%\.wslconfig` の `memory=`) |
