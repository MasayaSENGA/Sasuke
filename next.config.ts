import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker イメージを小さくするため、実行に必要なファイルだけを .next/standalone に出力する
  output: "standalone",
  // 使用フレームワークを外部に知らせる X-Powered-By ヘッダーを出さない
  poweredByHeader: false,
};

export default nextConfig;
