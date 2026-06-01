import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { addClipToCollection } from "../../lib/api";
import { Range, RangeSelector, formatTimecode } from "./RangeSelector";

export function AddClipDialog({
  collectionId,
  duration,
  existingClips,
  open,
  onClose,
  onPreview,
  initialRange
}: {
  collectionId: string;
  duration: number;
  existingClips: Array<{ start: number; end: number; label?: string }>;
  open: boolean;
  onClose: () => void;
  onPreview?: (start: number, end: number) => void;
  initialRange?: Range;
}) {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<Range>(initialRange ?? { start: 0, end: Math.min(60, duration) });
  const [clipTitle, setClipTitle] = useState("");
  const [whyPicked, setWhyPicked] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      addClipToCollection(collectionId, {
        start_sec: range.start,
        end_sec: range.end,
        clip_title: clipTitle,
        why_picked: whyPicked || undefined
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection", collectionId] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      onClose();
    }
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">添加精彩片段</h2>
          <button className="text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <RangeSelector duration={duration} existingClips={existingClips} value={range} onChange={setRange} onPreview={onPreview} />

          <form
            className="space-y-3 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">片段标题（必填）</span>
              <input
                type="text"
                required
                value={clipTitle}
                onChange={(e) => setClipTitle(e.target.value)}
                placeholder="例如：冰岛长板速降"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">为什么挑这一段</span>
              <textarea
                rows={3}
                value={whyPicked}
                onChange={(e) => setWhyPicked(e.target.value)}
                placeholder="例如：无台词的纯视觉叙事 + Major Tom 配乐推进，是教科书级的旅行片节奏样本"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
              />
            </label>
            <p className="text-xs text-zinc-500">
              将切出 {formatTimecode(range.start)} → {formatTimecode(range.end)}（约 {(range.end - range.start).toFixed(0)} 秒），
              ffmpeg 编码为 ≤1080p 独立 mp4，时间戳归零，作为新的 clip sample 落库后即可走标准拉片流程。
            </p>
            {mutation.isError ? <p className="text-xs text-red-600">{(mutation.error as Error).message}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="rounded-md border border-zinc-200 px-3 py-1.5 dark:border-zinc-800" onClick={onClose}>
                取消
              </button>
              <button
                type="submit"
                className="rounded-md bg-zinc-950 px-3 py-1.5 text-white dark:bg-white dark:text-zinc-950"
                disabled={!clipTitle.trim() || mutation.isPending}
              >
                {mutation.isPending ? "切片中..." : "切出片段"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
