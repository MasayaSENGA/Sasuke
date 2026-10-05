@AGENTS.md

# Sasuke プロジェクトメモ

- 概要・構成・セットアップは README.md を参照。
- Next.js 16 / Prisma 7 / Better Auth を使用。いずれも学習データと API が異なる可能性があるため、`node_modules` 内のドキュメントや型定義を確認してから書くこと。
  - Next.js 16 では middleware は `src/proxy.ts`。`headers()` / `cookies()` / `params` は非同期。
  - Prisma 7 はクライアントを `src/generated/prisma` に生成し、ドライバアダプタ経由で接続する。スキーマ変更後は `npm run db:migrate` → `npx prisma generate`。
- SwitchBot のトークン/シークレットはサーバー側 (`server-only`) でのみ扱い、クライアントに渡さない。
- 変更後は `npm run lint` と `npm run typecheck` を通すこと。
