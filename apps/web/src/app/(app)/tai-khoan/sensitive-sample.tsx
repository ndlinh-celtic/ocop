"use client";

import { useState, useTransition } from "react";
import { useReauth } from "@/components/reauth-dialog";
import { sensitiveSampleAction } from "./actions";

export function SensitiveSample() {
  const { run, dialog } = useReauth();
  const [done, setDone] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-2">Thao tác nhạy cảm (xác nhận phiếu, chốt điểm) yêu cầu xác thực trong vòng 5 phút gần nhất.</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => run(sensitiveSampleAction, (v) => setDone(`Đã thực hiện; xác thực bằng ${v.method}.`)))}
        className="self-start rounded-md border border-brand px-4 py-2 font-medium text-brand disabled:opacity-60"
      >
        Thử thao tác nhạy cảm
      </button>
      {done && (
        <p role="status" className="text-sm text-brand">
          {done}
        </p>
      )}
      {dialog}
    </div>
  );
}
