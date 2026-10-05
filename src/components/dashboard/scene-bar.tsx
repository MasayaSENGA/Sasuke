"use client";

import { useState } from "react";
import type { Scene } from "@/lib/switchbot/types";

/** SwitchBot アプリで作った手動実行シーンのボタン列 */
export function SceneBar({ scenes }: { scenes: Scene[] }) {
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  if (scenes.length === 0) return null;

  const run = async (scene: Scene) => {
    setRunning(scene.sceneId);
    setMessage(null);
    try {
      const res = await fetch(`/api/scenes/${encodeURIComponent(scene.sceneId)}/execute`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      setMessage(
        res.ok
          ? { text: `「${scene.sceneName}」を実行しました`, error: false }
          : { text: body.error ?? "シーンを実行できませんでした", error: true },
      );
    } catch {
      setMessage({ text: "通信に失敗しました", error: true });
    } finally {
      setRunning(null);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-zinc-500">シーン</h2>
      <div className="flex flex-wrap gap-2">
        {scenes.map((scene) => (
          <button
            key={scene.sceneId}
            type="button"
            onClick={() => run(scene)}
            disabled={running !== null}
            className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {running === scene.sceneId ? "実行中…" : `▶ ${scene.sceneName}`}
          </button>
        ))}
      </div>
      {message && (
        <p role="status" className={`text-sm ${message.error ? "text-red-600" : "text-emerald-600"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
