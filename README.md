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
| 運用想定 | Amazon Lightsail |

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
    login/ signup/       ログイン・アカウント作成画面
    dashboard/           ダッシュボード (要ログイン)
  components/            UI コンポーネント
  lib/
    auth.ts              Better Auth サーバー設定
    auth-client.ts       Better Auth クライアント
    db.ts                Prisma クライアント
    crypto.ts            SwitchBot 認証情報の暗号化 (AES-256-GCM)
    switchbot/           SwitchBot API クライアントと型定義
  proxy.ts               未ログイン時のリダイレクト (Next.js 16 の旧 middleware)
```

## 設計メモ

- **SwitchBot の認証情報**: ユーザーごとに SwitchBot アプリで発行したトークン/シークレットを登録し、`ENCRYPTION_KEY` で暗号化して DB に保存する。API 呼び出しはすべてサーバー側で行い、ブラウザには渡さない。
- **API 制限**: SwitchBot API は 1 日 10,000 回まで。ステータスのポーリング間隔やキャッシュに注意する。
- **SwitchBot トークンの取得**: SwitchBot アプリ → プロフィール → 設定 → アプリバージョンを 10 回タップ → 開発者向けオプション。

## 今後の実装予定

- [ ] SwitchBot トークン/シークレットの登録画面
- [ ] デバイス一覧・ステータス取得 API (Route Handler)
- [ ] ダッシュボードのタイル表示 (温湿度計・プラグ・カーテン・赤外線リモコンなど)
- [ ] タイルからのデバイス操作
- [ ] Lightsail へのデプロイ構成 (Docker / systemd、HTTPS)
