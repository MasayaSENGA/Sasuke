# Sasuke

SwitchBot API を使った家電ダッシュボード Web アプリ。
アプリ独自のアカウントでログインし、温度・湿度や各家電の動作状況をタイル表示、そこから操作できることを目指す。

## 技術スタック

| 領域 | 採用技術 |
| --- | --- |
| フレームワーク | Next.js 16 (App Router) / React 19 / TypeScript |
| スタイル | Tailwind CSS v4 |
| 認証 | Better Auth (メールアドレス + パスワード) |
| DB | Prisma 7 + SQLite (`@prisma/adapter-better-sqlite3`) |
| 外部 API | SwitchBot Open API v1.1 |
| 運用 | Amazon Lightsail + Docker Compose + Caddy (HTTPS) |

## セットアップ

```bash
npm install
cp .env.example .env   # 各シークレットを openssl rand -base64 32 で生成して記入
npm run db:migrate     # SQLite の DB を作成
npm run dev            # http://localhost:3000
```

## 主なスクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー起動 |
| `npm run build` / `npm start` | 本番ビルド / 起動 |
| `npm run lint` / `npm run typecheck` | ESLint / 型チェック |
| `npm run db:migrate` | スキーマ変更をマイグレーションとして適用 (開発) |
| `npm run db:deploy` | 既存マイグレーションを適用 (本番) |
| `npm run db:studio` | Prisma Studio で DB を閲覧 |

## ディレクトリ構成

```
prisma/
  schema.prisma          DB スキーマ (認証テーブル + SwitchBot 認証情報)
src/
  app/
    api/auth/[...all]/   Better Auth のエンドポイント
    api/devices/         デバイス一覧・ステータス取得・コマンド送信 API
    api/scenes/          シーン一覧・実行 API
    api/webhooks/        SwitchBot からの Webhook 受信口
    api/events/          ダッシュボードへのリアルタイム配信 (SSE)
    api/history/         温湿度の履歴 API
    login/ signup/       ログイン・アカウント作成画面
    (app)/               ログイン必須ページ (共通ヘッダー付き)
      dashboard/         ダッシュボード (デバイスのタイル表示・操作)
      settings/          SwitchBot トークン/シークレット・Webhook の設定
      history/           温湿度の履歴グラフ
  components/
    dashboard/           デバイスタイル (種別ごとの表示・操作)、シーン
    history/             履歴グラフ
  lib/
    auth.ts              Better Auth サーバー設定
    auth-client.ts       Better Auth クライアント
    db.ts                Prisma クライアント
    crypto.ts            SwitchBot 認証情報の暗号化 (AES-256-GCM)
    switchbot/
      client.ts          SwitchBot API クライアント (HMAC 署名)
      service.ts         デバイス一覧・ステータス取得 (キャッシュ付き)
      devices.ts         デバイス種別の分類
      credentials.ts     認証情報の保存・読み出し
      cache.ts           API 回数節約のためのメモリキャッシュ
      mock.ts            開発用モック
      webhook.ts         Webhook の登録・解除と受信データの正規化
      events.ts          リアルタイム配信用のイベント
    history.ts           温湿度の記録・集計
    jobs.ts              定期処理 (温湿度の記録・古い記録の削除)
  instrumentation.ts     サーバー起動時に定期処理を開始
  proxy.ts               未ログイン時のリダイレクト (Next.js 16 の旧 middleware)
```

## デプロイ

Amazon Lightsail への手順は [docs/deploy-lightsail.md](docs/deploy-lightsail.md) を参照。

- 本番では新規アカウント作成が既定で無効。最初のアカウントを作るときだけ `ALLOW_SIGNUP=true` にする
- `GET /api/health` で死活確認できる (DB 接続も確認)

## 開発用モックモード

`SWITCHBOT_MOCK=true npm run dev` で起動すると、SwitchBot API を呼ばずに架空のデバイス (温湿度計・プラグ・照明・カーテン・ロック・エアコンなど) でダッシュボードを確認できる。本番ビルドでは常に無効。

## 対応デバイス

| タイル | 対象 | 操作 |
| --- | --- | --- |
| 室内環境 | 温湿度計 (Meter / Plus / Pro / CO2 / 屋外)、ハブ2/3 | 表示のみ (温度・湿度・CO₂) |
| スイッチ | プラグ、リレースイッチ、加湿器、空気清浄機、扇風機 | 電源 ON/OFF |
| ボット | Bot | 押す (押下モード) / ON・OFF (スイッチモード) |
| 照明 | シーリングライト、電球、テープライト | 電源 ON/OFF、明るさ |
| カーテン | カーテン、ロールスクリーン、ブラインドポール | 開ける / 停止 / 閉める |
| ロック | スマートロック各種 | 施錠 / 解錠 (確認あり) |
| センサー | 開閉・人感・在室・水漏れセンサー | 表示のみ |
| エアコン (赤外線) | ハブに登録したエアコン | 運転/停止、温度、モード、風量 |
| 家電 (赤外線) | テレビ・照明・扇風機など | ON/OFF (テレビは音量・チャンネルも) |

## その他の機能

- **シーン**: SwitchBot アプリで作った手動実行シーンを、ダッシュボード上部のボタンから実行できる
- **リアルタイム更新 (Webhook)**: 設定画面から有効化すると、デバイスの状態変化が SwitchBot から通知され、開いているダッシュボードに即座に反映される (Server-Sent Events)。公開 HTTPS の URL が必要なため本番環境のみ
- **温湿度の履歴**: 温湿度計の値を記録し、「履歴」ページで 24 時間 / 7 日間 / 30 日間のグラフと表で表示する。90 日より古い記録は自動削除

## 設計メモ

- **SwitchBot の認証情報**: ユーザーごとに SwitchBot アプリで発行したトークン/シークレットを登録し、`ENCRYPTION_KEY` で暗号化して DB に保存する。API 呼び出しはすべてサーバー側で行い、ブラウザには渡さない。
- **API 制限**: SwitchBot API は 1 日 10,000 回まで。対策として以下を行っている。
  - デバイス一覧は 10 分、ステータスは 60 秒サーバー側でキャッシュ (手動更新時も 10 秒以内は再取得しない)
  - ダッシュボードの自動更新は 2 分間隔で、タブが表示されている間だけ
  - ステータス API を持たないデバイス (赤外線リモコン、ハブミニ等) は呼ばない
  - 目安: ステータス対応デバイス 10 台を 24 時間表示し続けて約 7,200 回 / 日
- **並び順・非表示**: ユーザーごとに `device_preference` テーブルへ保存する。非表示のデバイスはステータスを取得しない。
- **Webhook の安全性**: SwitchBot の Webhook には署名が無いため、推測できない秘密文字列を URL に含めて本人確認の代わりにする。DB には秘密文字列のハッシュだけを保存する。1 つの SwitchBot アカウントに登録できる Webhook は 1 つだけ
- **リアルタイム更新時の API 回数**: Webhook 有効時はダッシュボードの定期取得を 10 分間隔に延ばす。届いた変化はサーバーのキャッシュにも反映されるので、その間は API を呼ばない
- **温湿度の記録**: 同じデバイスは最短 5 分間隔。記録元は (1) Webhook、(2) ダッシュボード表示時の取得、(3) サーバーの定期処理 (既定 10 分ごと、`HISTORY_COLLECT_INTERVAL_MINUTES`)。(1)(2) で最近記録済みなら (3) は API を呼ばない。定期処理は `src/instrumentation.ts` からサーバー起動時に開始する
- **赤外線リモコン**: 状態を取得できないため、エアコンは最後に送った設定をブラウザ (localStorage) に保存して表示する。
- **SwitchBot トークンの取得**: SwitchBot アプリ → プロフィール → 設定 → アプリバージョンを 10 回タップ → 開発者向けオプション。

## 今後の実装予定

- [x] SwitchBot トークン/シークレットの登録画面
- [x] デバイス一覧・ステータス取得 API (Route Handler)
- [x] ダッシュボードのタイル表示 (温湿度計・プラグ・カーテン・赤外線リモコンなど)
- [x] タイルからのデバイス操作
- [x] Webhook によるリアルタイム更新
- [x] シーン実行
- [x] 温湿度の履歴グラフ
- [x] タイルの並び替え・表示/非表示
- [x] Lightsail へのデプロイ構成 (Docker Compose、Caddy による HTTPS)
