"use client";

import { useCallback, useState } from "react";
import type { DashboardDevice } from "@/lib/switchbot/devices";
import type { DeviceCommand, DeviceStatus } from "@/lib/switchbot/types";

/** 操作後、デバイス側の状態がクラウドに反映されるまで少し待ってから再取得する */
const REFETCH_DELAY_MS = 3000;

export type SendCommand = (
  command: DeviceCommand,
  optimistic?: Partial<DeviceStatus>,
) => Promise<boolean>;

export function useDeviceCommand(
  device: DashboardDevice,
  onUpdate: (device: DashboardDevice) => void,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send: SendCommand = useCallback(
    async (command, optimistic) => {
      setPending(true);
      setError(null);
      try {
        const res = await fetch(`/api/devices/${encodeURIComponent(device.id)}/commands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "操作に失敗しました");
          return false;
        }

        if (optimistic && device.status) {
          onUpdate({ ...device, status: { ...device.status, ...optimistic } });
        }
        // 赤外線リモコンはステータスを持たないので再取得しない
        if (!device.isInfrared && device.status) {
          setTimeout(async () => {
            const res = await fetch(`/api/devices/${encodeURIComponent(device.id)}?refresh=1`);
            if (res.ok) onUpdate((await res.json()).device);
          }, REFETCH_DELAY_MS);
        }
        return true;
      } catch {
        setError("通信に失敗しました");
        return false;
      } finally {
        setPending(false);
      }
    },
    [device, onUpdate],
  );

  return { send, pending, error };
}
