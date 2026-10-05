// サーバー起動時に 1 回だけ呼ばれる (Next.js の instrumentation)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackgroundJobs } = await import("./lib/jobs");
    startBackgroundJobs();
  }
}
