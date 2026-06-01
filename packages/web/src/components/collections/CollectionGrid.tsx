import { Link } from "react-router-dom";
import { Film, Layers } from "lucide-react";
import { CollectionListItem, mediaUrl } from "../../lib/api";
import { EmptyState } from "../shared/EmptyState";

export function CollectionGrid({ collections }: { collections: CollectionListItem[] }) {
  if (collections.length === 0) {
    return (
      <EmptyState
        title="还没有 Collection"
        body="先用「新建 Collection」创建一部电影/系列容器，再用 collection.import_master 把整片软链进来，然后切片拉片。"
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {collections.map((collection) => (
        <CollectionCard key={collection.id} collection={collection} />
      ))}
    </div>
  );
}

function CollectionCard({ collection }: { collection: CollectionListItem }) {
  const poster = mediaUrl(collection.poster_path ?? null);
  const subtitle = [collection.original_title, collection.release_year ? String(collection.release_year) : null, collection.director]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      to={`/collections/${collection.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
    >
      <div className="aspect-video w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {poster ? (
          <img src={poster} alt={collection.title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">
            <Film className="size-10" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-base font-semibold text-zinc-950 dark:text-zinc-50">{collection.title}</h3>
          <span className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {collection.kind}
          </span>
        </div>
        {subtitle ? <p className="line-clamp-1 text-sm text-zinc-500">{subtitle}</p> : null}
        <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <Layers className="size-3.5" />
            {collection.clip_count ?? 0} clip
          </span>
          {collection.duration_sec ? <span>整片 {formatDuration(collection.duration_sec)}</span> : null}
        </div>
      </div>
    </Link>
  );
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  return `${minutes}:${pad(secs)}`;
}

export function pad(num: number) {
  return num < 10 ? `0${num}` : String(num);
}
