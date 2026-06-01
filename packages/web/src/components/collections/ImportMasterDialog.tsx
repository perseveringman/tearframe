import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { importCollectionMaster } from "../../lib/api";

export function ImportMasterDialog({ collectionId, open, onClose }: { collectionId: string; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [path, setPath] = useState("");
  const [referenceOnly, setReferenceOnly] = useState(true);

  const mutation = useMutation({
    mutationFn: () => importCollectionMaster(collectionId, { input: path, reference_only: referenceOnly }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection", collectionId] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      onClose();
    }
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">导入整片为 master</h2>
          <button className="text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <form
          className="mt-4 space-y-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">本地绝对路径</span>
            <input
              type="text"
              required
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/Users/.../movie.mkv"
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
            />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={referenceOnly} onChange={(e) => setReferenceOnly(e.target.checked)} />
            <span className="text-xs text-zinc-500">仅引用（软链）—— 不复制原文件，不做 1080p 降采样</span>
          </label>
          {mutation.isError ? <p className="text-xs text-red-600">{(mutation.error as Error).message}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded-md border border-zinc-200 px-3 py-1.5 dark:border-zinc-800" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="rounded-md bg-zinc-950 px-3 py-1.5 text-white dark:bg-white dark:text-zinc-950"
              disabled={!path.trim() || mutation.isPending}
            >
              {mutation.isPending ? "导入中..." : "导入"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
