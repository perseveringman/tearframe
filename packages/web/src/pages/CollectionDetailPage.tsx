import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Film, Plus, Upload } from "lucide-react";
import { AddClipDialog } from "../components/collections/AddClipDialog";
import { ClipList } from "../components/collections/ClipList";
import { formatDuration } from "../components/collections/CollectionGrid";
import { ImportMasterDialog } from "../components/collections/ImportMasterDialog";
import { ErrorState } from "../components/shared/ErrorState";
import { LoadingSkeleton } from "../components/shared/LoadingSkeleton";
import { getCollection, mediaUrl } from "../lib/api";

export function CollectionDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);

  const detail = useQuery({
    queryKey: ["collection", id],
    queryFn: () => getCollection(id),
    enabled: Boolean(id)
  });

  const collection = detail.data?.collection;
  const master = detail.data?.master ?? null;
  const clips = detail.data?.clips ?? [];
  const duration = collection?.duration_sec ?? master?.duration_sec ?? 0;

  const masterUrl = mediaUrl(master?.local_path ?? null);
  const posterUrl = mediaUrl(collection?.poster_path ?? null);

  const existingClips = useMemo(
    () =>
      clips.map((clip) => ({
        start: clip.clip_start_sec ?? 0,
        end: clip.clip_end_sec ?? 0,
        label: clip.clip_title ?? clip.title
      })),
    [clips]
  );

  const handlePreview = (start: number, end: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = start;
    videoRef.current.play().catch(() => {});
    const onTimeUpdate = () => {
      if (!videoRef.current) return;
      if (videoRef.current.currentTime >= end) {
        videoRef.current.pause();
        videoRef.current.removeEventListener("timeupdate", onTimeUpdate);
      }
    };
    videoRef.current.addEventListener("timeupdate", onTimeUpdate);
  };

  if (detail.isLoading) {
    return (
      <main className="mx-auto max-w-[1400px] p-6">
        <LoadingSkeleton />
      </main>
    );
  }
  if (detail.isError || !collection) {
    return (
      <main className="mx-auto max-w-[1400px] p-6">
        <ErrorState message={detail.error?.message ?? "Collection not found"} />
      </main>
    );
  }

  const subtitle = [collection.original_title, collection.release_year ? String(collection.release_year) : null, collection.director, collection.language]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50"
        onClick={() => navigate("/collections")}
      >
        <ArrowLeft className="size-4" />
        返回 Collections
      </button>

      <section className="mt-3 grid gap-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
          {posterUrl ? (
            <img src={posterUrl} alt={collection.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400">
              <Film className="size-10" />
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {collection.kind}
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{collection.title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
          <div className="mt-3 grid gap-2 text-sm text-zinc-500 sm:grid-cols-3">
            <div>
              <div className="text-xs">整片时长</div>
              <div className="font-medium text-zinc-950 dark:text-zinc-50">{duration > 0 ? formatDuration(duration) : "未导入"}</div>
            </div>
            <div>
              <div className="text-xs">已切片段</div>
              <div className="font-medium text-zinc-950 dark:text-zinc-50">{clips.length}</div>
            </div>
            <div>
              <div className="text-xs">Master 分辨率</div>
              <div className="font-medium text-zinc-950 dark:text-zinc-50">{master?.resolution ?? "—"}</div>
            </div>
          </div>
          {collection.synopsis ? <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{collection.synopsis}</p> : null}
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            {!master ? (
              <button
                type="button"
                onClick={() => setImporting(true)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
              >
                <Upload className="size-4" />
                导入整片为 master
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
                disabled={duration <= 0}
              >
                <Plus className="size-4" />
                添加精彩片段
              </button>
            )}
            {master ? (
              <Link
                to={`/samples/${master.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-4 text-sm font-medium dark:border-zinc-800"
              >
                查看 master 样片
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {master && masterUrl ? (
        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div>
              <video
                ref={videoRef}
                src={masterUrl}
                controls
                className="aspect-video w-full rounded-lg bg-black"
                preload="metadata"
              />
              <div className="mt-2 text-xs text-zinc-500">软链原始文件，仅本地播放，不上传。</div>
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">已切精彩片段</h2>
              <div className="mt-3">
                <ClipList collectionId={collection.id} clips={clips} />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          先导入整片作为 master，再开始切片。
        </section>
      )}

      <ImportMasterDialog collectionId={collection.id} open={importing} onClose={() => setImporting(false)} />
      {duration > 0 ? (
        <AddClipDialog
          collectionId={collection.id}
          duration={duration}
          existingClips={existingClips}
          open={adding}
          onClose={() => setAdding(false)}
          onPreview={handlePreview}
        />
      ) : null}
    </main>
  );
}
