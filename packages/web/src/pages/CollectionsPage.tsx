import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film, Plus } from "lucide-react";
import { CollectionGrid } from "../components/collections/CollectionGrid";
import { CreateCollectionDialog } from "../components/collections/CreateCollectionDialog";
import { ErrorState } from "../components/shared/ErrorState";
import { LoadingSkeleton } from "../components/shared/LoadingSkeleton";
import { listCollections } from "../lib/api";

export function CollectionsPage() {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [kind, setKind] = useState("");

  const collections = useQuery({
    queryKey: ["collections", { keyword, kind }],
    queryFn: () => listCollections({ q: keyword || undefined, kind: kind || undefined })
  });

  const items = collections.data?.items ?? [];

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
      <section className="space-y-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-medium text-zinc-500">电影聚合</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                把一部长片拆成可持续追加的精彩片段。
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Collection 是一个容器：先把整片软链进来当 master，再用时间轴选段切出独立 1080p clip，每段走标准拉片流程。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
            >
              <Plus className="size-4" />
              新建 Collection
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <input
            type="text"
            placeholder="搜索标题、导演、原标题"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="min-w-[180px] flex-1 bg-transparent px-2 py-1 outline-none"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <option value="">全部类型</option>
            <option value="movie">电影</option>
            <option value="series">剧集</option>
            <option value="season">单季</option>
            <option value="playlist">播放列表</option>
          </select>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500">
            <Film className="size-3.5" />
            共 {collections.data?.total ?? 0} 个
          </span>
        </div>

        {collections.isError ? <ErrorState message={collections.error.message} /> : null}
        {collections.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <LoadingSkeleton />
            <LoadingSkeleton />
            <LoadingSkeleton />
          </div>
        ) : (
          <CollectionGrid collections={items} />
        )}
      </section>

      <CreateCollectionDialog open={open} onClose={() => setOpen(false)} />
    </main>
  );
}
