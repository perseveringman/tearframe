import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileText,
  ListPlus,
  Play,
  Save,
  Scissors,
  Search,
  Sparkles,
  Subtitles,
  Trash2,
  type LucideIcon
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "../components/shared/EmptyState";
import { ErrorState } from "../components/shared/ErrorState";
import {
  finalizeHighlight,
  getHighlight,
  getHighlightWorkspace,
  materializeHighlightClips,
  mediaUrl,
  submitHighlightSegments,
  suggestHighlightSegments,
  type HighlightCandidate,
  type HighlightRun,
  type HighlightSegment
} from "../lib/api";
import { platformLabel } from "../lib/labels";

type DraftSegment = {
  local_id: string;
  start_sec: string;
  end_sec: string;
  title: string;
  transcript_excerpt: string;
  reason: string;
  tags: string;
  confidence: string;
};

export function HighlightDetailPage() {
  const { id } = useParams();
  const highlightId = id ?? "";
  const queryClient = useQueryClient();
  const [workspaceFilter, setWorkspaceFilter] = useState({ q: "", start_sec: "", end_sec: "", max_segments: "180" });
  const [suggestForm, setSuggestForm] = useState({ keywords: "", target_duration_sec: "45", max_candidates: "10" });
  const [suggestions, setSuggestions] = useState<HighlightCandidate[]>([]);
  const [drafts, setDrafts] = useState<DraftSegment[]>([]);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [materializePad, setMaterializePad] = useState("");

  const runQuery = useQuery({ queryKey: ["highlight", highlightId], queryFn: () => getHighlight(highlightId), enabled: Boolean(highlightId) });
  const workspaceQuery = useQuery({
    queryKey: ["highlight-workspace", highlightId, workspaceFilter],
    queryFn: () =>
      getHighlightWorkspace(highlightId, {
        q: workspaceFilter.q || undefined,
        start_sec: toOptionalNumber(workspaceFilter.start_sec),
        end_sec: toOptionalNumber(workspaceFilter.end_sec),
        max_segments: toOptionalNumber(workspaceFilter.max_segments) ?? 180
      }),
    enabled: Boolean(highlightId)
  });

  const suggestMutation = useMutation({
    mutationFn: () =>
      suggestHighlightSegments(highlightId, {
        keywords: splitTags(suggestForm.keywords),
        target_duration_sec: toOptionalNumber(suggestForm.target_duration_sec),
        max_candidates: toOptionalNumber(suggestForm.max_candidates)
      }),
    onSuccess: (data) => setSuggestions(data.items)
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitHighlightSegments(
        highlightId,
        drafts.map((draft) => ({
          start_sec: Number(draft.start_sec),
          end_sec: Number(draft.end_sec),
          title: draft.title,
          transcript_excerpt: draft.transcript_excerpt || undefined,
          reason: draft.reason,
          tags: splitTags(draft.tags),
          confidence: toOptionalNumber(draft.confidence)
        }))
      ),
    onSuccess: () => {
      setDrafts([]);
      setSelectedSegmentIds([]);
      queryClient.invalidateQueries({ queryKey: ["highlight", highlightId] });
      queryClient.invalidateQueries({ queryKey: ["highlights"] });
    }
  });

  const materializeMutation = useMutation({
    mutationFn: () =>
      materializeHighlightClips(highlightId, {
        segment_ids: selectedSegmentIds.length > 0 ? selectedSegmentIds : undefined,
        pad_sec: toOptionalNumber(materializePad),
        overwrite: false
      }),
    onSuccess: () => {
      setSelectedSegmentIds([]);
      queryClient.invalidateQueries({ queryKey: ["highlight", highlightId] });
      queryClient.invalidateQueries({ queryKey: ["highlights"] });
      queryClient.invalidateQueries({ queryKey: ["samples"] });
    }
  });

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeHighlight(highlightId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highlight", highlightId] });
      queryClient.invalidateQueries({ queryKey: ["highlights"] });
    }
  });

  if (runQuery.isError) return <main className="mx-auto max-w-[1200px] px-4 py-6 lg:px-6"><ErrorState message={runQuery.error.message} /></main>;
  if (workspaceQuery.isError) return <main className="mx-auto max-w-[1200px] px-4 py-6 lg:px-6"><ErrorState message={workspaceQuery.error.message} /></main>;

  const run = runQuery.data;
  const workspace = workspaceQuery.data;
  const sample = workspace?.sample;
  const transcript = workspace?.transcript;
  const unmaterialized = run?.segments.filter((segment) => !segment.clip_sample_id) ?? [];
  const selectedForCut = selectedSegmentIds.length > 0 ? selectedSegmentIds.length : unmaterialized.length;
  const canSubmitDrafts = drafts.length > 0 && drafts.every((draft) => draft.title.trim() && draft.reason.trim() && Number(draft.end_sec) > Number(draft.start_sec));

  return (
    <main className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-4 lg:h-[100dvh] lg:overflow-hidden lg:px-5">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <Link to="/highlights" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          <ArrowLeft className="size-4" />
          返回快速剪辑
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {run ? <StatusPill status={run.status} /> : null}
          {sample ? <CompactTag>{platformLabel(sample.platform)}</CompactTag> : null}
          {sample?.local_path ? <CompactTag>源视频就绪</CompactTag> : <CompactTag>仅字幕</CompactTag>}
        </div>
      </div>

      <section className="grid shrink-0 gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">Highlight Workspace</p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{sample?.title ?? "读取快速剪辑任务"}</h1>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{run?.goal || "从 transcript 里挑出最值得裁剪的口播片段。"}</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Metric icon={Subtitles} label="字幕" value={transcript?.total_segments ?? 0} />
          <Metric icon={FileText} label="片段" value={run?.segments.length ?? 0} />
          <Metric icon={Scissors} label="已裁" value={run?.segments.filter((segment) => segment.clip_sample_id).length ?? 0} />
          <Metric icon={Clock3} label="余量" value={`${run?.pad_sec ?? 1}s`} />
        </div>
      </section>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.82fr)_430px]">
        <section className="flex min-h-0 flex-col rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50">
                <Play className="size-4 text-cyan-600 dark:text-cyan-300" />
                源视频
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">{sample?.local_path ? "裁剪会从这个本地源文件生成 clip sample。" : "当前只有字幕，提交片段可以保存，裁剪需要先 sample.import。"}</p>
            </div>
            {sample ? (
              <Link to={`/samples/${sample.id}`} className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900">
                样片详情
              </Link>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 p-3">
            {sample?.local_path ? (
              <video src={mediaUrl(sample.local_path)} controls className="h-full min-h-[260px] w-full rounded-lg bg-zinc-950 object-contain ring-1 ring-zinc-950/10 dark:ring-white/10" />
            ) : (
              <EmptyState title="没有本地源视频" body="可以先提交字幕片段；要真正裁剪 clip，需要从 YouTube/本地路径重新 sample.import。" />
            )}
          </div>
          <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800">
            <SegmentList
              run={run}
              selected={selectedSegmentIds}
              onToggle={(segmentId) => setSelectedSegmentIds((current) => (current.includes(segmentId) ? current.filter((id) => id !== segmentId) : [...current, segmentId]))}
            />
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="shrink-0 border-b border-zinc-200 p-3 dark:border-zinc-800">
            <h2 className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50">
              <Subtitles className="size-4 text-cyan-600 dark:text-cyan-300" />
              Transcript 浏览
            </h2>
            <form className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <div className="relative col-span-2">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-zinc-400" />
                <input
                  value={workspaceFilter.q}
                  onChange={(event) => setWorkspaceFilter({ ...workspaceFilter, q: event.target.value })}
                  placeholder="关键词过滤"
                  className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-3 outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
                />
              </div>
              <SmallInput value={workspaceFilter.start_sec} onChange={(value) => setWorkspaceFilter({ ...workspaceFilter, start_sec: value })} placeholder="开始秒" />
              <SmallInput value={workspaceFilter.end_sec} onChange={(value) => setWorkspaceFilter({ ...workspaceFilter, end_sec: value })} placeholder="结束秒" />
            </form>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {transcript?.segments.length === 0 ? <EmptyState title="没有匹配字幕" body="换一个关键词或放宽时间范围。" /> : null}
            <div className="space-y-1.5">
              {(transcript?.segments ?? []).map((segment, index) => (
                <article key={`${segment.start_sec}-${index}`} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => addDraftFromRange({ start_sec: segment.start_sec, end_sec: segment.end_sec, transcript_excerpt: segment.text, title: textTitle(segment.text) }, setDrafts)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-cyan-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-cyan-950/30"
                    >
                      <ListPlus className="size-3.5" />
                      加入
                    </button>
                    <p className="min-w-0 flex-1 leading-6 text-zinc-700 dark:text-zinc-300">{segment.text}</p>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-zinc-500">
                    {formatTime(segment.start_sec)} → {formatTime(segment.end_sec)}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="shrink-0 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
            返回 {transcript?.returned_segments ?? 0}/{transcript?.total_segments ?? 0} 条 {transcript?.truncated ? "，已截断" : ""}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <section className="shrink-0 rounded-xl border border-zinc-200 bg-zinc-950 p-3 text-white shadow-sm dark:border-zinc-800">
            <h2 className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-cyan-300" />
              候选生成
            </h2>
            <form
              className="mt-3 grid grid-cols-[minmax(0,1fr)_80px_72px] gap-2 text-sm"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                suggestMutation.mutate();
              }}
            >
              <input
                value={suggestForm.keywords}
                onChange={(event) => setSuggestForm({ ...suggestForm, keywords: event.target.value })}
                placeholder="关键词，逗号分隔"
                className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-white outline-none placeholder:text-zinc-500 focus:border-cyan-300"
              />
              <input
                type="number"
                value={suggestForm.target_duration_sec}
                onChange={(event) => setSuggestForm({ ...suggestForm, target_duration_sec: event.target.value })}
                className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-2 text-white outline-none focus:border-cyan-300"
              />
              <button type="submit" disabled={suggestMutation.isPending} className="rounded-md bg-cyan-300 px-3 py-2 font-semibold text-zinc-950 disabled:opacity-50">
                生成
              </button>
            </form>
            {suggestMutation.isError ? <p className="mt-2 rounded-md bg-red-500/10 px-2 py-1.5 text-xs text-red-200">{suggestMutation.error.message}</p> : null}
          </section>

          <section className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">候选与草稿</h2>
              <button type="button" onClick={() => addBlankDraft(setDrafts)} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900">
                <ListPlus className="size-3.5" />
                空片段
              </button>
            </div>

            <div className="mt-2 space-y-2">
              {suggestions.map((candidate) => (
                <SuggestionCard key={`${candidate.start_sec}-${candidate.end_sec}`} candidate={candidate} onUse={() => addDraftFromRange(candidate, setDrafts)} />
              ))}
              {suggestions.length === 0 ? <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700">还没有候选。可以先生成候选，或从字幕行直接加入草稿。</p> : null}
            </div>

            <div className="mt-3 space-y-2">
              {drafts.map((draft, index) => (
                <DraftEditor key={draft.local_id} index={index} draft={draft} onChange={(next) => setDrafts((current) => current.map((item) => (item.local_id === draft.local_id ? next : item)))} onRemove={() => setDrafts((current) => current.filter((item) => item.local_id !== draft.local_id))} />
              ))}
            </div>
          </section>

          <section className="shrink-0 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            {submitMutation.isError ? <ErrorState message={submitMutation.error.message} /> : null}
            {materializeMutation.isError ? <ErrorState message={materializeMutation.error.message} /> : null}
            {finalizeMutation.isError ? <ErrorState message={finalizeMutation.error.message} /> : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!canSubmitDrafts || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                <Save className="size-4" />
                提交片段
              </button>
              <button
                type="button"
                disabled={!run || selectedForCut === 0 || materializeMutation.isPending}
                onClick={() => materializeMutation.mutate()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <Scissors className="size-4" />
                裁剪 {selectedForCut || ""}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_130px] gap-2">
              <input
                type="number"
                min="0"
                step="0.5"
                value={materializePad}
                onChange={(event) => setMaterializePad(event.target.value)}
                placeholder={`裁剪余量默认 ${run?.pad_sec ?? 1}s`}
                className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
              />
              <button
                type="button"
                disabled={!run || run.status === "done" || finalizeMutation.isPending}
                onClick={() => finalizeMutation.mutate()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="size-4" />
                完成
              </button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function SegmentList({ run, selected, onToggle }: { run?: HighlightRun; selected: string[]; onToggle: (segmentId: string) => void }) {
  if (!run) return <EmptyState title="读取片段中" />;
  if (run.segments.length === 0) return <EmptyState title="还没有提交片段" body="从字幕或候选里加入草稿，然后提交为正式片段。" />;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">已提交片段</h3>
        <span className="font-mono text-xs text-zinc-500">{run.segments.length} segments</span>
      </div>
      <div className="max-h-52 space-y-2 overflow-auto pr-1">
        {run.segments.map((segment) => (
          <article key={segment.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selected.includes(segment.id)}
                disabled={Boolean(segment.clip_sample_id)}
                onChange={() => onToggle(segment.id)}
                className="mt-1 size-4 rounded border-zinc-300"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">{segment.title}</h4>
                  {segment.clip_sample_id ? (
                    <Link to={`/samples/${segment.clip_sample_id}`} className="shrink-0 rounded-md bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                      clip
                    </Link>
                  ) : (
                    <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800">未裁</span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{segment.reason}</p>
                <div className="mt-1 font-mono text-[11px] text-zinc-500">
                  {formatTime(segment.start_sec)} → {formatTime(segment.end_sec)} · {formatDuration(segment.end_sec - segment.start_sec)}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({ candidate, onUse }: { candidate: HighlightCandidate; onUse: () => void }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-[11px] text-zinc-500">
          {formatTime(candidate.start_sec)} → {formatTime(candidate.end_sec)} · score {candidate.score}
        </div>
        <button type="button" onClick={onUse} className="rounded-md bg-zinc-950 px-2 py-1 text-xs font-semibold text-white dark:bg-white dark:text-zinc-950">
          使用
        </button>
      </div>
      <p className="mt-1 line-clamp-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{candidate.transcript_excerpt}</p>
      <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{candidate.reasons.join(" · ")}</p>
    </article>
  );
}

function DraftEditor({ index, draft, onChange, onRemove }: { index: number; draft: DraftSegment; onChange: (draft: DraftSegment) => void; onRemove: () => void }) {
  return (
    <article className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-2.5 dark:border-cyan-900/70 dark:bg-cyan-950/20">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">草稿 {index + 1}</h3>
        <button type="button" onClick={onRemove} className="rounded-md p-1.5 text-zinc-500 hover:bg-white hover:text-red-600 dark:hover:bg-zinc-900">
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <SmallInput value={draft.start_sec} onChange={(value) => onChange({ ...draft, start_sec: value })} placeholder="start" />
        <SmallInput value={draft.end_sec} onChange={(value) => onChange({ ...draft, end_sec: value })} placeholder="end" />
      </div>
      <input
        value={draft.title}
        onChange={(event) => onChange({ ...draft, title: event.target.value })}
        placeholder="标题"
        className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
      />
      <textarea
        rows={2}
        value={draft.reason}
        onChange={(event) => onChange({ ...draft, reason: event.target.value })}
        placeholder="为什么值得剪"
        className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
      />
      <textarea
        rows={2}
        value={draft.transcript_excerpt}
        onChange={(event) => onChange({ ...draft, transcript_excerpt: event.target.value })}
        placeholder="字幕摘录"
        className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
      />
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_82px] gap-2">
        <input
          value={draft.tags}
          onChange={(event) => onChange({ ...draft, tags: event.target.value })}
          placeholder="tags"
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
        />
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={draft.confidence}
          onChange={(event) => onChange({ ...draft, confidence: event.target.value })}
          placeholder="0.8"
          className="rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
        />
      </div>
    </article>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-base font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</div>
    </div>
  );
}

function SmallInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <input
      type="number"
      min="0"
      step="0.1"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-white"
    />
  );
}

function StatusPill({ status }: { status: HighlightRun["status"] }) {
  const copy = {
    running: ["处理中", "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300"],
    done: ["已完成", "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"],
    failed: ["失败", "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"]
  } satisfies Record<HighlightRun["status"], [string, string]>;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${copy[status][1]}`}>
      {status === "running" ? <CircleDashed className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
      {copy[status][0]}
    </span>
  );
}

function CompactTag({ children }: { children: string }) {
  return (
    <span className="rounded-md border border-zinc-200 bg-white/75 px-2 py-1 text-xs font-medium text-zinc-600 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-400">
      {children}
    </span>
  );
}

function addBlankDraft(setDrafts: React.Dispatch<React.SetStateAction<DraftSegment[]>>) {
  setDrafts((current) => [
    ...current,
    {
      local_id: `draft_${Date.now()}_${current.length}`,
      start_sec: "",
      end_sec: "",
      title: "",
      transcript_excerpt: "",
      reason: "",
      tags: "",
      confidence: "0.75"
    }
  ]);
}

function addDraftFromRange(
  range: Pick<HighlightCandidate, "start_sec" | "end_sec" | "transcript_excerpt"> & { title?: string },
  setDrafts: React.Dispatch<React.SetStateAction<DraftSegment[]>>
) {
  setDrafts((current) => [
    ...current,
    {
      local_id: `draft_${Date.now()}_${current.length}`,
      start_sec: String(Math.round(range.start_sec * 10) / 10),
      end_sec: String(Math.round(range.end_sec * 10) / 10),
      title: range.title ?? textTitle(range.transcript_excerpt),
      transcript_excerpt: range.transcript_excerpt,
      reason: "",
      tags: "",
      confidence: "0.75"
    }
  ]);
}

function textTitle(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 22 ? `${compact.slice(0, 22)}...` : compact || "关键口播片段";
}

function splitTags(value: string) {
  return value
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toOptionalNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatTime(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "--:--";
  const total = Math.max(0, Math.round(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(value: number) {
  return `${Math.max(0, Math.round(value))}s`;
}
