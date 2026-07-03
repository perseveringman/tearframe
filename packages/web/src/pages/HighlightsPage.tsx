import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock3, FileText, ListFilter, Scissors, Search, Sparkles, Subtitles } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ErrorState } from "../components/shared/ErrorState";
import { LoadingSkeleton } from "../components/shared/LoadingSkeleton";
import { listHighlights, listSamples, startHighlight, type HighlightRun } from "../lib/api";
import { platformLabel } from "../lib/labels";

export function HighlightsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sampleSearch, setSampleSearch] = useState("");
  const [form, setForm] = useState({
    sample_id: searchParams.get("sample_id") ?? "",
    goal: "",
    max_clip_count: "8",
    min_duration_sec: "18",
    max_duration_sec: "90",
    pad_sec: "1"
  });

  const samples = useQuery({
    queryKey: ["samples", "highlight-picker"],
    queryFn: () => listSamples({ include_clips: 1, pageSize: 200 })
  });
  const highlights = useQuery({ queryKey: ["highlights"], queryFn: () => listHighlights() });
  const sampleById = useMemo(() => new Map((samples.data?.items ?? []).map((sample) => [sample.id, sample])), [samples.data?.items]);
  const filteredSamples = useMemo(() => {
    const normalized = sampleSearch.trim().toLowerCase();
    const items = samples.data?.items ?? [];
    const visible = !normalized
      ? items.slice(0, 80)
      : items
      .filter((sample) => [sample.title, sample.author, sample.author_handle, sample.source_video_id, ...sample.sub_tags].filter(Boolean).join(" ").toLowerCase().includes(normalized))
      .slice(0, 80);
    const selected = items.find((sample) => sample.id === form.sample_id);
    return selected && !visible.some((sample) => sample.id === selected.id) ? [selected, ...visible.slice(0, 79)] : visible;
  }, [form.sample_id, sampleSearch, samples.data?.items]);

  const createRun = useMutation({
    mutationFn: () =>
      startHighlight({
        sample_id: form.sample_id,
        goal: form.goal || undefined,
        max_clip_count: toNumber(form.max_clip_count),
        min_duration_sec: toNumber(form.min_duration_sec),
        max_duration_sec: toNumber(form.max_duration_sec),
        pad_sec: toNumber(form.pad_sec)
      }),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["highlights"] });
      navigate(`/highlights/${run.id}`);
    }
  });

  const runs = highlights.data?.items ?? [];
  const activeRuns = runs.filter((run) => run.status === "running").length;
  const clipCount = runs.reduce((total, run) => total + run.segments.filter((segment) => segment.clip_sample_id).length, 0);

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 lg:px-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-medium text-zinc-500">快速口播剪辑</p>
                <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">用字幕找重点，用源视频裁片段。</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  这条路径不生成 storyboard，也不要求逐帧看图。适合 YouTube 字幕、播客、讲座、访谈和大段 talking-head 视频。
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Metric icon={Subtitles} label="任务" value={runs.length} />
                <Metric icon={Clock3} label="进行中" value={activeRuns} />
                <Metric icon={Scissors} label="已裁片" value={clipCount} />
              </div>
            </div>
          </div>

          {highlights.isError ? <ErrorState message={highlights.error.message} /> : null}
          {highlights.isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <LoadingSkeleton />
              <LoadingSkeleton />
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {runs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                  还没有快速剪辑任务。右侧选择一个已导入的视频创建任务。
                </div>
              ) : null}
              {runs.map((run) => (
                <HighlightRunCard key={run.id} run={run} sampleTitle={sampleById.get(run.sample_id)?.title ?? run.sample_id} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50">
                  <Sparkles className="size-4 text-cyan-600 dark:text-cyan-300" />
                  新建快速任务
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-500">先选择样片，再设置本次剪辑目标和片段约束。</p>
              </div>
            </div>

            <form
              className="mt-4 space-y-3 text-sm"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                createRun.mutate();
              }}
            >
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-500">筛选样片</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-zinc-400" />
                  <input
                    value={sampleSearch}
                    onChange={(event) => setSampleSearch(event.target.value)}
                    placeholder="搜索标题、作者或标签"
                    className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-3 outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-500">样片（必填）</span>
                <select
                  required
                  value={form.sample_id}
                  onChange={(event) => setForm({ ...form, sample_id: event.target.value })}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
                >
                  <option value="">选择一个已导入样片</option>
                  {filteredSamples.map((sample) => (
                    <option key={sample.id} value={sample.id}>
                      {sample.title} · {platformLabel(sample.platform)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-500">剪辑目标</span>
                <textarea
                  rows={3}
                  value={form.goal}
                  onChange={(event) => setForm({ ...form, goal: event.target.value })}
                  placeholder="例如：剪出适合二创的强观点、方法论、反常识结论"
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="最多片段" value={form.max_clip_count} onChange={(value) => setForm({ ...form, max_clip_count: value })} />
                <NumberField label="裁剪余量秒" value={form.pad_sec} onChange={(value) => setForm({ ...form, pad_sec: value })} step="0.5" />
                <NumberField label="最短秒数" value={form.min_duration_sec} onChange={(value) => setForm({ ...form, min_duration_sec: value })} />
                <NumberField label="最长秒数" value={form.max_duration_sec} onChange={(value) => setForm({ ...form, max_duration_sec: value })} />
              </div>
              {createRun.isError ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-200">{createRun.error.message}</p> : null}
              <button
                type="submit"
                disabled={!form.sample_id || createRun.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 active:translate-y-px disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {createRun.isPending ? "创建中..." : "创建并打开工作台"}
                <ArrowRight className="size-4" />
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            <h2 className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50">
              <ListFilter className="size-4" />
              快速模式协议
            </h2>
            <ol className="mt-3 space-y-2">
              <li>1. `highlight.start` 复用或生成 transcript。</li>
              <li>2. `highlight.get_workspace` 分窗口读取字幕。</li>
              <li>3. `highlight.submit_segments` 保存关键口播片段。</li>
              <li>4. `highlight.materialize_clips` 裁成独立 clip sample。</li>
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}

function HighlightRunCard({ run, sampleTitle }: { run: HighlightRun; sampleTitle: string }) {
  const materialized = run.segments.filter((segment) => segment.clip_sample_id).length;
  return (
    <Link
      to={`/highlights/${run.id}`}
      className="group block rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-cyan-300 hover:bg-cyan-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-cyan-900 dark:hover:bg-cyan-950/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-zinc-500">{sampleTitle}</p>
          <h3 className="mt-1 truncate text-base font-semibold text-zinc-950 dark:text-zinc-50">{run.goal || "快速口播剪辑"}</h3>
        </div>
        <StatusPill status={run.status} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-500">
        <RunStat icon={FileText} label="片段" value={run.segments.length} />
        <RunStat icon={Scissors} label="已裁" value={materialized} />
        <RunStat icon={Clock3} label="余量" value={`${run.pad_sec}s`} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>{formatDateTime(run.created_at)}</span>
        <span className="inline-flex items-center gap-1 font-medium text-cyan-700 dark:text-cyan-300">
          打开
          <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Subtitles; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon className="size-4" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-zinc-950 dark:text-zinc-50">{value}</div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = "1" }: { label: string; value: string; onChange: (value: string) => void; step?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
      />
    </label>
  );
}

function RunStat({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number | string }) {
  return (
    <span className="inline-flex items-center justify-center gap-1 rounded-md bg-zinc-50 px-2 py-1 font-mono tabular-nums dark:bg-zinc-900">
      <Icon className="size-3.5" />
      {value} {label}
    </span>
  );
}

function StatusPill({ status }: { status: HighlightRun["status"] }) {
  const classes = {
    running: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
    done: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    failed: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
  }[status];
  const label = { running: "处理中", done: "已完成", failed: "失败" }[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${classes}`}>
      <CheckCircle2 className="size-3.5" />
      {label}
    </span>
  );
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatDateTime(value?: string | null) {
  if (!value) return "未记录";
  return value.replace("T", " ").slice(0, 16);
}
