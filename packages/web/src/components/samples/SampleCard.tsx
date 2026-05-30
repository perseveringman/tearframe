import { Bookmark, Clock3, Film, Heart, ImageOff, MessageCircle, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import type { Sample } from "@tearframe/shared";
import { mediaUrl } from "../../lib/api";
import { platformLabel, statusLabel, videoCategoryLabel } from "../../lib/labels";

export function SampleCard({ sample }: { sample: Sample }) {
  const tags = sample.sub_tags.slice(0, 3);
  const extraTagCount = Math.max(0, sample.sub_tags.length - tags.length);

  return (
    <Link to={`/samples/${sample.id}`} className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60">
      <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700">
        <div className="relative aspect-video overflow-hidden bg-zinc-200 dark:bg-zinc-900">
          {sample.thumbnail_path ? (
            <img src={mediaUrl(sample.thumbnail_path)} alt={`${sample.title} 封面`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" />
          ) : (
            <FallbackCover title={sample.title} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/45" />
          <div className="absolute left-3 top-3 rounded-md bg-black/75 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            {platformLabel(sample.platform)}
          </div>
          <StatusBadge status={sample.teardown_status} />
          <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs font-medium text-white/90">
            <span className="inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 backdrop-blur">
              <Film className="size-3.5" />
              {sample.resolution ?? "video"}
            </span>
          </div>
          <div className="absolute bottom-3 right-3 rounded-md bg-black/75 px-2 py-1 font-mono text-xs font-semibold text-white tabular-nums backdrop-blur">
            {formatDuration(sample.duration_sec)}
          </div>
        </div>

        <div className="p-4">
          <h3 className="line-clamp-2 min-h-[3.25rem] text-lg font-semibold leading-snug text-zinc-950 text-pretty dark:text-zinc-50">{sample.title}</h3>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            <UserRound className="size-3.5 shrink-0" />
            <span className="truncate">{sample.author ?? sample.author_handle ?? "未知作者"}</span>
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric icon={Heart} label="赞" value={sample.metrics.likes} />
            <Metric icon={Bookmark} label="藏" value={sample.metrics.collects} />
            <Metric icon={MessageCircle} label="评" value={sample.metrics.comments} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                {tag}
              </span>
            ))}
            {extraTagCount > 0 ? <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">+{extraTagCount}</span> : null}
            {sample.category ? <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">{videoCategoryLabel(sample.category)}</span> : null}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              {sample.added_at.slice(0, 10)}
            </span>
            <span className="font-mono tabular-nums">{sample.teardown_count} teardown</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function StatusBadge({ status }: { status: Sample["teardown_status"] }) {
  const tone =
    status === "done"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "running"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      : status === "failed"
        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";
  return <span className={`absolute right-3 top-3 shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold backdrop-blur ${tone}`}>{statusLabel(status)}</span>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Heart; label: string; value?: number }) {
  return (
    <div className="rounded-md bg-zinc-100 px-2.5 py-2 dark:bg-zinc-900">
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-zinc-950 dark:text-zinc-100">{formatCount(value)}</div>
    </div>
  );
}

function FallbackCover({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#18181b_0%,#27272a_48%,#111827_100%)] text-zinc-500">
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,.1)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative flex flex-col items-center gap-2 text-center">
        <ImageOff className="size-8 text-zinc-400" />
        <span className="max-w-[18rem] px-6 text-xs font-medium text-zinc-300">{title}</span>
      </div>
    </div>
  );
}

function formatDuration(value?: number | null) {
  if (!value || value <= 0) return "--:--";
  const total = Math.round(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatCount(value?: number) {
  if (!value) return "0";
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}w`;
  return value.toLocaleString("en-US");
}
