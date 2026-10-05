import "server-only";

// SwitchBot API は 1 日 10,000 回までなので、ユーザーごとに結果をメモリにキャッシュする。
// 同時に来た同じリクエスト (複数タブなど) は 1 回の API 呼び出しにまとめる。
// ※ プロセス内メモリなので、複数インスタンス構成にする場合は Redis 等へ置き換えること。

type Entry = { value: unknown; fetchedAt: number };

type CacheStore = {
  entries: Map<string, Entry>;
  inflight: Map<string, Promise<unknown>>;
};

const globalForCache = globalThis as unknown as { switchBotCache?: CacheStore };

const store: CacheStore = (globalForCache.switchBotCache ??= {
  entries: new Map(),
  inflight: new Map(),
});

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const entry = store.entries.get(key);
  if (entry && Date.now() - entry.fetchedAt < ttlMs) {
    return entry.value as T;
  }

  const pending = store.inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fetcher()
    .then((value) => {
      store.entries.set(key, { value, fetchedAt: Date.now() });
      return value;
    })
    .finally(() => store.inflight.delete(key));

  store.inflight.set(key, promise);
  return promise;
}

/** キャッシュ済みの値に部分的な更新を反映する (未キャッシュなら何もしない)。更新後の値を返す */
export function patch<T extends object>(key: string, partial: Partial<T>): T | undefined {
  const entry = store.entries.get(key);
  if (!entry) return undefined;
  const value = { ...(entry.value as T), ...partial };
  store.entries.set(key, { value, fetchedAt: Date.now() });
  return value;
}

export function invalidate(key: string) {
  store.entries.delete(key);
}

export function clearUserCache(userId: string) {
  for (const key of store.entries.keys()) {
    if (key.startsWith(`${userId}:`)) store.entries.delete(key);
  }
}
