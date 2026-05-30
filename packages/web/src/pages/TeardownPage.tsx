import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CARD_LABELS, Sample } from "@tearframe/shared";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  Clapperboard,
  CopyCheck,
  Eye,
  GitBranch,
  Layers3,
  ListTree,
  MapPinned,
  Music2,
  Network,
  PackageOpen,
  PlayCircle,
  Radar,
  Scissors,
  Sparkles,
  Subtitles,
  Volume2
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { normalizePayload } from "../components/teardown/cards/GenericCard";
import { FrameStrip } from "../components/teardown/FrameStrip";
import { type FrameData, type ShotData } from "../components/teardown/ShotAnalysisTable";
import { Timeline } from "../components/teardown/Timeline";
import { VideoPlayer } from "../components/teardown/VideoPlayer";
import { EmptyState } from "../components/shared/EmptyState";
import { ErrorState } from "../components/shared/ErrorState";
import { getMemoryDigest, getSample, getTeardown, listSampleResources, mediaUrl, MemoryDigest, StoryboardBeat, TeardownRecord } from "../lib/api";
import { seekInsideSegment } from "../lib/seek";
import { usePlayerStore } from "../stores/playerStore";

export function TeardownPage() {
  const { id } = useParams();
  const teardownId = id ?? "";
  const teardown = useQuery({ queryKey: ["teardown", teardownId], queryFn: () => getTeardown(teardownId), enabled: Boolean(teardownId) });
  const sampleId = teardown.data?.sample_id ?? "";
  const sample = useQuery({ queryKey: ["sample", sampleId], queryFn: () => getSample(sampleId), enabled: Boolean(sampleId) });
  const resources = useQuery({ queryKey: ["resources", sampleId], queryFn: () => listSampleResources(sampleId), enabled: Boolean(sampleId) });
  const memory = useQuery({ queryKey: ["memory", teardownId], queryFn: () => getMemoryDigest(teardownId), enabled: Boolean(teardown.data?.id) });
  const currentTime = usePlayerStore((state) => state.currentTime);

  if (teardown.isError) return <main className="mx-auto max-w-[1200px] px-4 py-6 lg:px-6"><ErrorState message={teardown.error.message} /></main>;

  const record = teardown.data;
  const points = record ? extractTimelinePoints(record.cards) : [];
  const framesResource = resources.data?.resources.find((resource) => resource.resource_type === "frames");
  const shotsResource = resources.data?.resources.find((resource) => resource.resource_type === "shots");
  const frames = Array.isArray(framesResource?.data)
    ? (framesResource.data as FrameData[]).map((frame) => ({ ...frame, path: mediaUrl(frame.path) ?? frame.path }))
    : [];
  const shots = Array.isArray(shotsResource?.data) ? (shotsResource.data as ShotData[]) : [];
  const currentBeat = record?.storyboard.find((beat) => currentTime >= beat.start_sec && currentTime < beat.end_sec) ?? record?.storyboard[0];

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 lg:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to={sampleId ? `/samples/${sampleId}` : "/"} className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          <ArrowLeft className="size-4" />
          返回样片
        </Link>
        {record ? (
          <Link to={`/teardowns/${record.id}/canvas`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900">
            <Network className="size-4" />
            关联画布
          </Link>
        ) : null}
      </div>
      <section className="space-y-4">
        <TeardownBrief record={record} sample={sample.data} digest={memory.data} points={points} frames={frames} shots={shots} />
        <VideoPlayer src={mediaUrl(sample.data?.local_path)} />
        {record ? (
          <LearningTabs
            record={record}
            sample={sample.data}
            digest={memory.data}
            memoryLoading={memory.isLoading}
            points={points}
            frames={frames}
            shots={shots}
            framesReady={resources.isSuccess}
            currentBeat={currentBeat}
            currentTime={currentTime}
          />
        ) : (
          <EmptyState title="正在读取拉片" body="拉片数据加载后，会按学习方向拆成多个 Tab。" />
        )}
      </section>
    </main>
  );
}

type LearningTabId = "overview" | "retention" | "storyline" | "structure" | "shooting" | "editing" | "audio" | "replicate" | "memory";

const LEARNING_TABS: Array<{ id: LearningTabId; label: string; icon: typeof Sparkles; description: string }> = [
  { id: "overview", label: "快速看懂", icon: Eye, description: "先判断这条片值不值得学" },
  { id: "retention", label: "为什么留人", icon: Sparkles, description: "开头、选题、文案钩子" },
  { id: "storyline", label: "故事线", icon: GitBranch, description: "作者如何安排理解、期待和回收" },
  { id: "structure", label: "怎么组织", icon: ListTree, description: "结构段落和节奏曲线" },
  { id: "shooting", label: "怎么拍", icon: Camera, description: "镜头、构图和素材清单" },
  { id: "editing", label: "怎么剪", icon: Scissors, description: "切点、密度和转场" },
  { id: "audio", label: "声音字幕", icon: Volume2, description: "配乐、歌词和字幕策略" },
  { id: "replicate", label: "怎么复刻", icon: CopyCheck, description: "变成拍摄和剪辑步骤" },
  { id: "memory", label: "历史关联", icon: Radar, description: "同类样片、聚类、图谱" }
];

function LearningTabs({
  record,
  sample,
  digest,
  memoryLoading,
  points,
  frames,
  shots,
  framesReady,
  currentBeat,
  currentTime
}: {
  record: TeardownRecord;
  sample?: Sample;
  digest?: MemoryDigest;
  memoryLoading: boolean;
  points: Array<{ timestamp_sec: number; label: string }>;
  frames: FrameData[];
  shots: ShotData[];
  framesReady: boolean;
  currentBeat?: StoryboardBeat;
  currentTime: number;
}) {
  const [activeTab, setActiveTab] = useState<LearningTabId>("overview");
  const active = LEARNING_TABS.find((tab) => tab.id === activeTab) ?? LEARNING_TABS[0]!;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {LEARNING_TABS.map((tab) => {
              const selected = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-w-[116px] shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition active:translate-y-px ${
                    selected
                      ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  <tab.icon className="size-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <Link
            to={`/teardowns/${record.id}/shots`}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 active:translate-y-px dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <Clapperboard className="size-4" />
            逐 shot 详细解读
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
      <div className="p-4 md:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <active.icon className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{active.label}</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{active.description}</p>
          </div>
        </div>
        {activeTab === "overview" ? <OverviewTab record={record} sample={sample} digest={digest} points={points} frames={frames} currentBeat={currentBeat} currentTime={currentTime} /> : null}
        {activeTab === "retention" ? <RetentionTab record={record} /> : null}
        {activeTab === "storyline" ? <StorylineTab record={record} /> : null}
        {activeTab === "structure" ? <StructureTab record={record} /> : null}
        {activeTab === "shooting" ? <ShootingTab record={record} frames={frames} shots={shots} framesReady={framesReady} /> : null}
        {activeTab === "editing" ? <EditingTab record={record} /> : null}
        {activeTab === "audio" ? <AudioTab record={record} /> : null}
        {activeTab === "replicate" ? <ReplicateTab record={record} /> : null}
        {activeTab === "memory" ? <MemoryPanel digest={digest} isLoading={memoryLoading} /> : null}
      </div>
    </section>
  );
}

function OverviewTab({
  record,
  sample,
  digest,
  points,
  frames,
  currentBeat,
  currentTime
}: {
  record: TeardownRecord;
  sample?: Sample;
  digest?: MemoryDigest;
  points: Array<{ timestamp_sec: number; label: string }>;
  frames: FrameData[];
  currentBeat?: StoryboardBeat;
  currentTime: number;
}) {
  const topic = asRecord(record.cards.topic);
  const hook = asRecord(record.cards.hook);
  const structure = asRecord(record.cards.structure);
  const topScores = digest?.scores.slice(0, 4) ?? [];
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <CurrentInsightPanel beat={currentBeat} currentTime={currentTime} />
        <FocusCard
          eyebrow="一句话判断"
          title={sample?.title ?? "这条片"}
          body={stringValue(topic, "summary") || stringValue(hook, "retention_logic") || "还没有足够导读信息。"}
          points={compact([
            stringValue(topic, "transferable_formula") || stringValue(topic, "reusable_skeleton"),
            stringValue(structure, "skeleton_template"),
            stringValue(hook, "next_question_in_viewer_mind") ? `观众会问：${stringValue(hook, "next_question_in_viewer_mind")}` : ""
          ])}
        />
        {points.length > 0 ? <Timeline points={points.slice(0, 12)} /> : <EmptyState title="还没有时间线证据" body="agent 提交 evidence 后，这里会出现最值得看的关键点。" />}
        {frames.length > 0 ? <FrameStrip frames={frames.slice(0, 16)} /> : null}
      </div>
      <div className="space-y-4">
        <section className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
          <h3 className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50"><BarChart3 className="size-4" />作品评分</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">先看这条片在同类样片里大概处于什么水平。</p>
          <div className="mt-3 space-y-2">
            {topScores.length > 0 ? topScores.map((score) => <ScoreBar key={score.dimension} score={score} />) : <p className="text-sm text-zinc-500">等待记忆评分生成。</p>}
          </div>
        </section>
        <MetricGrid digest={digest} points={points} frames={frames} />
      </div>
    </div>
  );
}

function RetentionTab({ record }: { record: TeardownRecord }) {
  const hook = asRecord(record.cards.hook);
  const topic = asRecord(record.cards.topic);
  const copy = asRecord(record.cards.copy);
  const earlyBeats = record.storyboard.filter((beat) => beat.start_sec <= 10).slice(0, 4);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <FocusCard eyebrow="开头钩子" title={stringValue(hook, "hook_type") || "开头策略"} body={stringValue(hook, "summary") || "还没有 hook 卡。"} points={compact([stringValue(hook, "retention_logic"), stringValue(hook, "next_question_in_viewer_mind")])} />
        <FocusCard eyebrow="选题动机" title={stringValue(topic, "angle_type") || "为什么值得看"} body={stringValue(topic, "summary") || "还没有 topic 卡。"} points={compact([stringValue(topic, "question"), stringValue(topic, "why_now")])} />
        <FocusCard eyebrow="第一句话" title={firstSentenceText(copy) || firstSentenceText(hook) || "首句/标题"} body={stringValue(copy, "summary") || "这里应该说明第一句如何制造期待。"} points={stringArrayValue(copy, "key_lines").slice(0, 3)} />
      </div>
      {earlyBeats.length > 0 ? <BeatStrip title="前 10 秒逐镜头" beats={earlyBeats} /> : <EmptyState title="缺少前 10 秒分镜" body="agent 需要提交前几个 shot 的 visual_summary、narrative_function 和 reusable_pattern。" />}
    </div>
  );
}

function StorylineTab({ record }: { record: TeardownRecord }) {
  const structure = asRecord(record.cards.structure);
  const storyline = asRecord(structure.storyline);
  const arc = asRecord(storyline.protagonist_arc);
  const storyBeats = arrayRecords(storyline.story_beats);
  const payoffs = arrayRecords(storyline.setup_payoffs);
  const premise = stringValue(storyline, "premise");

  if (!premise && storyBeats.length === 0) {
    return (
      <EmptyState
        title="缺少整体故事线"
        body="agent 需要在 structure.storyline 中提交 premise、protagonist_arc、story_beats 和 setup_payoffs，说明作者如何安排观众的理解、提问和情绪回收。"
      />
    );
  }

  return (
    <div className="space-y-4">
      <FocusCard
        eyebrow="故事总弧"
        title={premise || stringValue(structure, "archetype") || "这条片讲了什么变化"}
        body={stringValue(arc, "transformation") || stringValue(structure, "summary") || "这里应该说明主角、观看期待或情绪从哪里变到哪里。"}
        points={compact([
          stringValue(arc, "start_state") ? `起点：${stringValue(arc, "start_state")}` : "",
          stringValue(arc, "end_state") ? `终点：${stringValue(arc, "end_state")}` : "",
          stringValue(structure, "skeleton_template")
        ])}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-zinc-500">story spine</p>
              <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">故事推进线</h3>
            </div>
            <span className="rounded-md bg-white px-2 py-1 font-mono text-xs text-zinc-500 dark:bg-zinc-950/70">{storyBeats.length} beats</span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {storyBeats.map((beat, index) => (
              <StoryBeatCard key={`${numberValue(beat, "start_sec") ?? index}-${stringValue(beat, "label")}`} beat={beat} index={index} storyboard={record.storyboard} />
            ))}
          </div>
        </section>
        <div className="space-y-4">
          <section className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
            <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">作者编排意图</h3>
            <div className="mt-3 space-y-3 text-sm leading-6">
              <StoryArcRow label="起点" value={stringValue(arc, "start_state")} />
              <StoryArcRow label="转变" value={stringValue(arc, "transformation")} />
              <StoryArcRow label="终点" value={stringValue(arc, "end_state")} />
            </div>
          </section>
          <PayoffMap payoffs={payoffs} />
        </div>
      </div>
    </div>
  );
}

function StoryArcRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 dark:bg-zinc-950/70">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <p className="mt-1 text-zinc-700 dark:text-zinc-300">{value || "待补充"}</p>
    </div>
  );
}

function StoryBeatCard({
  beat,
  index,
  storyboard
}: {
  beat: Record<string, unknown>;
  index: number;
  storyboard: StoryboardBeat[];
}) {
  const seekTo = usePlayerStore((state) => state.seekTo);
  const start = numberValue(beat, "start_sec");
  const end = numberValue(beat, "end_sec");
  const evidenceShots = numberArrayValue(beat, "evidence_shots");
  const evidenceBeats = evidenceShots
    .map((shotIndex) => storyboard.find((item) => item.shot_index === shotIndex))
    .filter((item): item is StoryboardBeat => Boolean(item));
  const seekToBeat = () => {
    if (start != null && end != null) seekTo?.(seekInsideSegment(start, end));
  };

  return (
    <article className="rounded-lg bg-white p-3 text-sm dark:bg-zinc-950/70">
      <div className="flex items-start justify-between gap-3">
        <button onClick={seekToBeat} className="min-w-0 text-left transition hover:text-cyan-700 active:translate-y-px dark:hover:text-cyan-300">
          <span className="font-mono text-xs text-zinc-500 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
          <h4 className="mt-1 break-words font-semibold leading-5 text-zinc-950 dark:text-zinc-50">{stringValue(beat, "label") || `故事节点 ${index + 1}`}</h4>
        </button>
        {start != null && end != null ? <span className="shrink-0 font-mono text-xs text-zinc-500">{formatRange(start, end)}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {storyFunctionLabel(stringValue(beat, "story_function"))}
        </span>
      </div>
      {evidenceBeats.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {evidenceBeats.slice(0, 4).map((item) => (
            <button
              key={`${item.shot_index}-${item.start_sec}-thumb`}
              onClick={() => seekTo?.(seekInsideSegment(item.start_sec, item.end_sec))}
              className="group overflow-hidden rounded-lg bg-zinc-100 text-left transition hover:ring-2 hover:ring-cyan-400/70 active:translate-y-px dark:bg-zinc-900"
              title={item.visual_summary}
            >
              <div className="relative aspect-video overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                {item.frame_path ? (
                  <img
                    src={mediaUrl(item.frame_path) ?? item.frame_path}
                    alt={`Shot ${item.shot_index}: ${item.visual_summary}`}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-500">Shot {item.shot_index}</div>
                )}
                <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                  Shot {item.shot_index}
                </span>
              </div>
              <p className="line-clamp-2 px-2 py-1.5 text-[11px] leading-4 text-zinc-600 dark:text-zinc-400">{item.visual_summary}</p>
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-2 leading-6 text-zinc-700 dark:text-zinc-300">{stringValue(beat, "summary") || stringValue(beat, "author_intent")}</p>
      <div className="mt-3 grid gap-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
        <p><span className="font-semibold text-zinc-700 dark:text-zinc-300">观众知道：</span>{stringValue(beat, "viewer_knows")}</p>
        <p><span className="font-semibold text-zinc-700 dark:text-zinc-300">观众想问：</span>{stringValue(beat, "viewer_question")}</p>
        <p><span className="font-semibold text-zinc-700 dark:text-zinc-300">为什么此刻：</span>{stringValue(beat, "why_here")}</p>
      </div>
      {evidenceBeats.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {evidenceBeats.slice(0, 6).map((item) => (
            <button
              key={`${item.shot_index}-${item.start_sec}`}
              onClick={() => seekTo?.(seekInsideSegment(item.start_sec, item.end_sec))}
              className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-[11px] font-semibold text-zinc-600 transition hover:bg-cyan-100 hover:text-cyan-800 active:translate-y-px dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-200"
              title={item.visual_summary}
            >
              Shot {item.shot_index}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function PayoffMap({ payoffs }: { payoffs: Array<Record<string, unknown>> }) {
  const seekTo = usePlayerStore((state) => state.seekTo);
  if (payoffs.length === 0) return <EmptyState title="缺少铺垫回收" body="agent 应提交 setup_payoffs，标出哪些早期信息在后文被回收。" />;
  return (
    <section className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
      <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">铺垫 / 回收</h3>
      <div className="mt-3 space-y-2">
        {payoffs.map((item, index) => {
          const setup = numberValue(item, "setup_sec");
          const payoff = numberValue(item, "payoff_sec");
          return (
            <article key={`${setup ?? index}-${payoff ?? index}`} className="rounded-lg bg-white p-3 text-sm dark:bg-zinc-950/70">
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-500">
                {setup != null ? <button onClick={() => seekTo?.(setup)} className="rounded-md bg-zinc-100 px-2 py-1 transition hover:bg-zinc-200 active:translate-y-px dark:bg-zinc-900 dark:hover:bg-zinc-800">{formatSeconds(setup)}</button> : null}
                <ArrowRight className="size-3.5" />
                {payoff != null ? <button onClick={() => seekTo?.(payoff)} className="rounded-md bg-zinc-100 px-2 py-1 transition hover:bg-zinc-200 active:translate-y-px dark:bg-zinc-900 dark:hover:bg-zinc-800">{formatSeconds(payoff)}</button> : null}
              </div>
              <p className="mt-2 leading-6 text-zinc-700 dark:text-zinc-300">{stringValue(item, "setup")} / {stringValue(item, "payoff")}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{stringValue(item, "meaning")}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StructureTab({ record }: { record: TeardownRecord }) {
  const structure = asRecord(record.cards.structure);
  const pace = asRecord(record.cards.pace);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <FocusCard eyebrow="结构骨架" title={stringValue(structure, "archetype") || "这条片怎么组织"} body={stringValue(structure, "summary") || "还没有 structure 卡。"} points={compact([stringValue(structure, "skeleton_template"), stringValue(structure, "reusable_skeleton")])} />
        <SegmentList title="段落图" segments={arrayRecords(structure.segments)} />
        <SegmentList title="转折点" segments={arrayRecords(structure.turn_points)} />
      </div>
      <div className="space-y-4">
        <FocusCard eyebrow="节奏曲线" title={stringValue(pace, "overall_curve") || "节奏如何变化"} body={stringValue(pace, "summary") || "还没有 pace 卡。"} points={compact([stringValue(pace, "reusable_skeleton")])} />
        <SegmentList title="信息密度" segments={arrayRecords(pace.density_segments)} />
        <SegmentList title="呼吸点" segments={arrayRecords(pace.breath_points)} />
      </div>
    </div>
  );
}

function ShootingTab({
  record,
  frames,
  shots,
  framesReady
}: {
  record: TeardownRecord;
  frames: FrameData[];
  shots: ShotData[];
  framesReady: boolean;
}) {
  const shot = asRecord(record.cards.shot);
  const hasRows = record.storyboard.length > 0 || shots.length > 0;
  const shotCount = Math.max(shots.length, record.storyboard.length);
  const interpretedCount = record.storyboard.length;
  return (
    <div className="space-y-4">
      <FocusCard
        eyebrow="拍摄方法"
        title={stringValue(shot, "a_roll_style") || stringValue(shot, "cut_density") || "这条片怎么拍"}
        body={stringValue(shot, "summary") || "还没有 shot 卡。"}
        points={compact([stringArrayValue(shot, "b_roll_functions").join(" / "), stringValue(shot, "low_cost_replicable"), stringValue(shot, "reusable_skeleton")])}
      />
      {hasRows ? (
        <Link
          to={`/teardowns/${record.id}/shots`}
          className="group block rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition hover:border-cyan-300 hover:bg-cyan-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 active:translate-y-px dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-cyan-900 dark:hover:bg-cyan-950/20"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <Clapperboard className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">shot table</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">逐 shot 详细解读</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">进入沉浸式左右分栏：左侧固定视频，右侧铺满镜头表格，适合一边播放一边扫完整字段。</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-zinc-600 dark:text-zinc-400 sm:min-w-[300px]">
              <ShotReviewMetric label="镜头" value={String(shotCount)} />
              <ShotReviewMetric label="解读" value={`${interpretedCount}/${shotCount}`} />
              <ShotReviewMetric label="关键帧" value={framesReady ? String(frames.length) : "--"} />
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition group-hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:group-hover:bg-white">
            打开沉浸式页面
            <ArrowRight className="size-4" />
          </div>
        </Link>
      ) : (
        <EmptyState title="缺少逐镜头解读" body="agent 需要基于镜头切分，为每个 shot 提交关键帧、景别、画面内容、旁白、背景音、摄像机角度和构图解读。" />
      )}
    </div>
  );
}

function ShotReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 dark:bg-zinc-950/70">
      <div className="font-medium text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-base font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</div>
    </div>
  );
}

function formatRange(start: number, end: number) {
  return `${formatSeconds(start)} - ${formatSeconds(end)}`;
}

function formatSeconds(value: number) {
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `${fixed}s`;
}

function EditingTab({ record }: { record: TeardownRecord }) {
  const edit = asRecord(record.cards.edit);
  const pace = asRecord(record.cards.pace);
  const editBeats = record.storyboard.filter((beat) => beat.edit_note).slice(0, 8);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <FocusCard eyebrow="剪辑逻辑" title={stringValue(edit, "tempo_map") || "怎么剪"} body={stringValue(edit, "summary") || "还没有 edit 卡。"} points={compact([stringValue(edit, "reusable_skeleton"), stringArrayValue(edit, "transitions").join(" / "), stringArrayValue(edit, "jump_cuts").join(" / ")])} />
        <FocusCard eyebrow="停顿和加速" title={stringValue(pace, "overall_curve") || "节奏控制"} body={stringValue(pace, "summary") || "还没有 pace 卡。"} points={compact([stringArrayValue(edit, "pause_points").join(" / "), stringArrayValue(pace, "breath_points").join(" / ")])} />
      </div>
      {editBeats.length > 0 ? <BeatStrip title="关键剪辑点" beats={editBeats} mode="edit" /> : <EmptyState title="缺少剪辑点说明" body="agent 需要在 storyboard beat 里写 edit_note，并在 edit 卡里写 transitions、pause_points。" />}
    </div>
  );
}

function AudioTab({ record }: { record: TeardownRecord }) {
  const music = asRecord(record.cards.music);
  const subtitle = asRecord(record.cards.subtitle);
  const copy = asRecord(record.cards.copy);
  const audioBeats = record.storyboard.filter((beat) => beat.background_audio || beat.audio_note || beat.voiceover || beat.transcript_excerpt).slice(0, 8);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <FocusCard eyebrow="配乐" title={stringValue(music, "reference_genre") || "音乐承担什么"} body={stringValue(music, "summary") || "还没有 music 卡。"} points={compact([stringValue(music, "mood_curve"), stringValue(music, "reusable_skeleton")])} />
        <FocusCard eyebrow="字幕" title={stringValue(subtitle, "strategy") || "字幕怎么用"} body={stringValue(subtitle, "summary") || "还没有 subtitle 卡。"} points={compact([stringValue(subtitle, "emphasis_style"), stringValue(subtitle, "color_coding"), stringArrayValue(subtitle, "keyword_choices").join(" / ")])} />
        <FocusCard eyebrow="文案" title={stringValue(copy, "first_line") || "标题/首句"} body={stringValue(copy, "summary") || "还没有 copy 卡。"} points={stringArrayValue(copy, "key_lines").slice(0, 3)} />
      </div>
      {audioBeats.length > 0 ? <BeatStrip title="声音对应画面" beats={audioBeats} mode="audio" /> : null}
    </div>
  );
}

function ReplicateTab({ record }: { record: TeardownRecord }) {
  return (
    <div className="space-y-4">
      {Object.keys(record.cards).length > 0 ? <ProductionPlan cards={record.cards} beats={record.storyboard} /> : <EmptyState title="还不能生成复刻方案" body="agent 需要先提交 topic、structure、shot、edit、music、subtitle 等卡片。" />}
      <TemplateList templates={record.templates} />
    </div>
  );
}

function MetricGrid({ digest, points, frames }: { digest?: MemoryDigest; points: Array<{ timestamp_sec: number; label: string }>; frames: FrameData[] }) {
  return (
    <section className="grid grid-cols-2 gap-3">
      <MetricTile label="平均分" value={digest?.average_score == null ? "--" : digest.average_score.toFixed(1)} />
      <MetricTile label="历史关联" value={String(digest?.relation_count ?? 0)} />
      <MetricTile label="关键点" value={String(points.length)} />
      <MetricTile label="关键帧" value={String(frames.length)} />
    </section>
  );
}

function FocusCard({ eyebrow, title, body, points }: { eyebrow: string; title: string; body: string; points?: string[] }) {
  return (
    <article className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{eyebrow}</p>
      <h3 className="mt-1 text-lg font-semibold leading-tight text-zinc-950 dark:text-zinc-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{body}</p>
      {points && points.length > 0 ? (
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {points.map((point) => (
            <li key={point} className="flex gap-2">
              <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-emerald-500" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function BeatStrip({ title, beats, mode = "summary" }: { title: string; beats: StoryboardBeat[]; mode?: "summary" | "edit" | "audio" }) {
  const seekTo = usePlayerStore((state) => state.seekTo);
  return (
    <section className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
      <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {beats.map((beat) => (
          <button
            key={beat.id ?? `${beat.shot_index}-${beat.start_sec}`}
            onClick={() => seekTo?.(seekInsideSegment(beat.start_sec, beat.end_sec))}
            className="rounded-lg bg-white p-3 text-left transition hover:bg-zinc-50 active:translate-y-px dark:bg-zinc-950/70 dark:hover:bg-zinc-950"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-zinc-950 dark:text-zinc-50">Shot {beat.shot_index}</span>
              <span className="font-mono text-xs text-zinc-500">{formatRange(beat.start_sec, beat.end_sec)}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {mode === "edit" ? beat.edit_note || beat.visual_summary : mode === "audio" ? beat.background_audio || beat.audio_note || beat.voiceover || beat.transcript_excerpt || beat.visual_summary : beat.visual_summary}
            </p>
            {beat.reusable_pattern ? <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">复用：{beat.reusable_pattern}</p> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function SegmentList({ title, segments }: { title: string; segments: Array<Record<string, unknown>> }) {
  if (segments.length === 0) return <EmptyState title={`${title} 尚未提交`} body="agent 需要用数组结构提交可渲染的段落/转折点。" />;
  return (
    <section className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
      <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <div className="mt-3 space-y-2">
        {segments.map((segment, index) => (
          <article key={`${title}-${index}`} className="rounded-lg bg-white p-3 text-sm dark:bg-zinc-950/70">
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold text-zinc-950 dark:text-zinc-50">{stringValue(segment, "label") || stringValue(segment, "name") || `段落 ${index + 1}`}</span>
              {numberValue(segment, "start_sec") != null ? <span className="font-mono text-xs text-zinc-500">{formatSeconds(numberValue(segment, "start_sec")!)}</span> : null}
            </div>
            <p className="mt-1 leading-6 text-zinc-600 dark:text-zinc-400">{stringValue(segment, "summary") || stringifyCompact(segment)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function TemplateList({ templates }: { templates: TeardownRecord["templates"] }) {
  if (templates.length === 0) return <EmptyState title="还没有模板骨架" body="agent 需要提交可填空、可复用的模板，而不是只写一段总结。" />;
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="flex items-center gap-2 font-semibold"><PackageOpen className="size-4" />模板骨架</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {templates.map((template) => (
          <article key={template.id} className="rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
            <div className="font-semibold text-zinc-950 dark:text-zinc-50">{template.title}</div>
            <p className="mt-2 whitespace-pre-wrap leading-6 text-zinc-600 dark:text-zinc-400">{template.body_md}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function TeardownBrief({
  record,
  sample,
  digest,
  points,
  frames,
  shots
}: {
  record?: TeardownRecord;
  sample?: Sample;
  digest?: MemoryDigest;
  points: Array<{ timestamp_sec: number; label: string }>;
  frames: FrameData[];
  shots: ShotData[];
}) {
  const cards = record?.cards ?? {};
  const hook = asRecord(cards.hook);
  const structure = asRecord(cards.structure);
  const topic = asRecord(cards.topic);
  const guide = stringValue(hook, "retention_logic") || stringValue(structure, "skeleton_template") || stringValue(topic, "summary") || sample?.why_collected || "等待 agent 提交更多卡片后，这里会生成可跳播、可比较、可复用的导读。";
  const topDimension = digest?.top_dimension ? CARD_LABELS[digest.top_dimension] : "未评分";

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
          <span>{record?.status ?? "loading"}</span>
          <span>/</span>
          <span>{record?.lens ?? "generic"}</span>
          {sample?.category ? (
            <>
              <span>/</span>
              <span>{sample.category}</span>
            </>
          ) : null}
        </div>
        <h1 className="mt-3 max-w-4xl text-2xl font-semibold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50 md:text-3xl">{sample?.title ?? "拉片报告"}</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">{guide}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {sample?.author ? <Signal label="作者" value={sample.author} /> : null}
          <Signal label="镜头" value={`${shots.length || record?.storyboard.length || 0}`} />
          <Signal label="关键点" value={`${points.length}`} />
          <Signal label="关键帧" value={`${frames.length}`} />
          <Signal label="最高维度" value={topDimension} />
          <Signal label="平均分" value={digest?.average_score == null ? "--" : digest.average_score.toFixed(1)} />
        </div>
      </div>
    </section>
  );
}

function CurrentInsightPanel({ beat, currentTime }: { beat?: StoryboardBeat; currentTime: number }) {
  const seekTo = usePlayerStore((state) => state.seekTo);
  if (!beat) {
    return <EmptyState title="还没有当前片段解读" body="提交分镜分析后，视频播放时这里会自动跟随当前镜头。" />;
  }
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
            <PlayCircle className="size-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">当前片段 / {formatSeconds(currentTime)}</p>
            <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">Shot {beat.shot_index}</h2>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => seekTo?.(seekInsideSegment(beat.start_sec, beat.end_sec))}
              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 font-mono text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 active:translate-y-px dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              {formatRange(beat.start_sec, beat.end_sec)}
            </button>
            <p className="min-w-[220px] flex-1 text-sm font-medium leading-6 text-zinc-800 dark:text-zinc-100">{beat.visual_summary}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            {beat.shot_size ? <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-900">景别：{beat.shot_size}</span> : null}
            {beat.camera_angle ? <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-900">角度：{beat.camera_angle}</span> : null}
            {beat.voiceover ? <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-900">旁白：{beat.voiceover}</span> : null}
            {beat.background_audio ? <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-900">背景音：{beat.background_audio}</span> : null}
            {beat.narrative_function ? <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-900">功能：{beat.narrative_function}</span> : null}
            {beat.reusable_pattern ? <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-900">复用：{beat.reusable_pattern}</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function MemoryPanel({ digest, isLoading }: { digest?: MemoryDigest; isLoading: boolean }) {
  if (isLoading) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="h-4 w-28 rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="mt-4 space-y-2">
          <div className="h-14 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-14 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </section>
    );
  }
  if (!digest || digest.item_count === 0) {
    return <EmptyState title="记忆尚未生成" body="拉片 finalize 后会自动生成评分、历史关联、聚类，并按配置同步 Graphiti。" />;
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500">memory graph</p>
          <h2 className="mt-1 flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50">
            <Radar className="size-4" />
            历史语料关联
          </h2>
        </div>
        <span className={graphitiStatusClass(digest.graphiti.status)}>{digest.graphiti.status}</span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            <BarChart3 className="size-4" />
            作品评分
          </div>
          <p className="mb-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">按作品质量和可复用价值校准；分析完整度只影响置信度。</p>
          <div className="space-y-2">
            {digest.scores.slice(0, 6).map((score) => (
              <ScoreBar key={score.dimension} score={score} />
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            <GitBranch className="size-4" />
            相关样片
          </div>
          {digest.related.length > 0 ? (
            <div className="space-y-2">
              {digest.related.slice(0, 4).map((relation) => (
                <Link
                  key={relation.id}
                  to={`/teardowns/${relation.target_teardown_id}`}
                  className="block rounded-lg bg-white p-3 text-sm transition hover:bg-zinc-50 active:translate-y-px dark:bg-zinc-950/70 dark:hover:bg-zinc-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-zinc-950 dark:text-zinc-50">{relation.target_title ?? relation.target_sample_id}</span>
                    <span className="font-mono text-xs text-zinc-500">{Math.round(relation.strength * 100)}%</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{relation.rationale}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">还没有足够历史样片形成稳定关联。</p>
          )}
        </div>

        <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            <Layers3 className="size-4" />
            聚类归属
          </div>
          <p className="mb-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">按创作模式归档；同类样片越多，模式名越稳定。</p>
          {digest.clusters.length > 0 ? (
            <ClusterMembershipList clusters={digest.clusters} />
          ) : (
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">聚类会在更多拉片完成后变得更有辨识度。</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ClusterMembershipList({ clusters }: { clusters: MemoryDigest["clusters"] }) {
  return (
    <div className="space-y-2">
      {clusters.slice(0, 6).map((cluster) => (
        <article key={cluster.id} className="rounded-lg bg-white p-3 text-sm dark:bg-zinc-950/70">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {CARD_LABELS[cluster.dimension]}
            </span>
            <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-zinc-500 tabular-nums">
              {cluster.strength == null ? null : <span>{Math.round(cluster.strength * 100)}%</span>}
              <span>{formatClusterCount(cluster.sample_count)}</span>
            </div>
          </div>
          <h3 className="mt-2 break-words font-semibold leading-5 text-zinc-950 dark:text-zinc-50">{clusterDisplayTitle(cluster)}</h3>
          {clusterDisplayReason(cluster) ? <p className="mt-1 break-words text-xs leading-5 text-zinc-600 dark:text-zinc-400">{clusterDisplayReason(cluster)}</p> : null}
          {clusterDisplayTerms(cluster).length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {clusterDisplayTerms(cluster).slice(0, 3).map((term) => (
                <span key={term} className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  {term}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

type ClusterDigestItem = MemoryDigest["clusters"][number];

const CLUSTER_FIELD_TERMS = new Set([
  "summary",
  "reusable_skeleton",
  "transferable_formula",
  "rhetorical_devices",
  "info_density_curve",
  "next_question_in_viewer_mind",
  "skeleton_template",
  "low_cost_replicable",
  "reference_genre",
  "keyword_choices",
  "first_sentence",
  "hook_type",
  "retention_logic",
  "timestamp_sec",
  "evidence",
  "归入",
  "匹配",
  "模式"
]);

const CLUSTER_ENUM_LABELS: Record<string, string> = {
  info_gap: "信息缺口",
  emotion_gap: "情绪落差",
  counter_consensus: "反共识角度",
  counter_intuitive: "反常识句",
  scene_immersion: "场景代入",
  benefit_promise: "收益承诺",
  low_cost_replicable: "低成本可复刻"
};

function clusterDisplayTitle(cluster: ClusterDigestItem) {
  const prefix = `${CARD_LABELS[cluster.dimension]}：`;
  const rawTitle = cluster.label.startsWith(prefix) ? cluster.label.slice(prefix.length) : cluster.label;
  return clusterDisplayTermsFromText(rawTitle)[0] ?? cleanClusterDisplayText(cluster.summary) ?? `${CARD_LABELS[cluster.dimension]}模式`;
}

function clusterDisplayReason(cluster: ClusterDigestItem) {
  const title = clusterDisplayTitle(cluster);
  const summary = cleanClusterDisplayText(cluster.summary);
  if (summary && summary !== title && /\p{Script=Han}/u.test(summary) && !hasInternalClusterNoise(summary)) return summary;
  const terms = clusterDisplayTerms(cluster);
  return terms.length > 0 ? `匹配词：${terms.slice(0, 3).join(" / ")}` : "";
}

function clusterDisplayTerms(cluster: ClusterDigestItem) {
  const title = clusterDisplayTitle(cluster);
  return uniqueDisplayTerms(cluster.centroid_terms.flatMap(clusterDisplayTermsFromText).filter((term) => term !== title));
}

function clusterDisplayTermsFromText(text: string) {
  return uniqueDisplayTerms(text.split(/\s*\/\s*|,|，|、|：|:/).map(normalizeClusterDisplayTerm).filter((term): term is string => Boolean(term)));
}

function normalizeClusterDisplayTerm(raw: string) {
  const lower = raw.trim().toLowerCase();
  if (CLUSTER_ENUM_LABELS[lower]) return CLUSTER_ENUM_LABELS[lower];
  const term = cleanClusterDisplayText(raw);
  const mapped = CLUSTER_ENUM_LABELS[term.toLowerCase()];
  if (mapped) return mapped;
  if (!term || CLUSTER_FIELD_TERMS.has(term) || CLUSTER_FIELD_TERMS.has(term.toLowerCase())) return null;
  if (/^(?:smp|tea|mem|clu|rel|tpl)_[a-z0-9_-]+$/i.test(term)) return null;
  if (/^[a-z]+_[a-z0-9_]+$/i.test(term)) return null;
  const readable = term.replace(/^的(?=观众|作者|用户)/u, "");
  return readable.length > 28 ? `${readable.slice(0, 28)}...` : readable;
}

function cleanClusterDisplayText(raw?: string) {
  const cleaned = (raw ?? "")
    .replace(/\b(?:smp|tea|mem|clu|rel|tpl)_[a-z0-9_-]+\b/gi, " ")
    .replace(/^#+\s*/, "")
    .replace(/^[a-z_]+:\s*/i, "")
    .replace(/[{}[\]"“”‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : "";
}

function hasInternalClusterNoise(text: string) {
  return /\b(?:smp|tea|mem|clu|rel|tpl)_/i.test(text) || Array.from(CLUSTER_FIELD_TERMS).some((term) => text.includes(term));
}

function uniqueDisplayTerms(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function formatClusterCount(count: number) {
  return count > 0 ? `${count} 样片` : "新聚类";
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      {label}: {value}
    </span>
  );
}

function MetricTile({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-lg bg-white p-3 dark:bg-zinc-950/70">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className={`mt-1 font-semibold text-zinc-950 dark:text-zinc-50 ${compact ? "text-sm" : "text-xl tabular-nums"}`}>{value}</div>
    </div>
  );
}

function ScoreBar({ score }: { score: MemoryDigest["scores"][number] }) {
  return (
    <div title={score.rationale}>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{CARD_LABELS[score.dimension]}</span>
        <span className="font-mono text-zinc-500 tabular-nums">{score.score.toFixed(1)} / {Math.round(score.confidence * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white dark:bg-zinc-950/70">
        <div className="h-full rounded-full bg-zinc-950 dark:bg-zinc-100" style={{ width: `${Math.max(4, Math.min(100, score.score * 10))}%` }} />
      </div>
    </div>
  );
}

function graphitiStatusClass(status: MemoryDigest["graphiti"]["status"]) {
  const base = "rounded-lg px-2.5 py-1.5 text-xs font-semibold";
  if (status === "synced") return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`;
  if (status === "failed") return `${base} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`;
  return `${base} bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400`;
}

type ProductionStep = {
  icon: typeof Sparkles;
  title: string;
  summary: string;
  checklist: string[];
};

function ProductionPlan({ cards, beats }: { cards: Record<string, unknown>; beats: StoryboardBeat[] }) {
  const steps = buildProductionSteps(cards, beats);
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-zinc-500">replication brief</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">如果我要拍一个类似的视频</h2>
        </div>
        <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">{steps.length} steps</span>
      </div>
      <div className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <article key={step.title} className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <step.icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-500 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">{step.title}</h3>
                </div>
                <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{step.summary}</p>
                <ul className="mt-2 grid gap-1.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                  {step.checklist.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function buildProductionSteps(cards: Record<string, unknown>, beats: StoryboardBeat[]): ProductionStep[] {
  const topic = asRecord(cards.topic);
  const structure = asRecord(cards.structure);
  const shot = asRecord(cards.shot);
  const edit = asRecord(cards.edit);
  const music = asRecord(cards.music);
  const copy = asRecord(cards.copy);
  const subtitle = asRecord(cards.subtitle);
  const pace = asRecord(cards.pace);
  const account = asRecord(cards.account);
  const openingBeat = beats[0];
  const climaxBeat = beats[Math.max(0, Math.floor(beats.length * 0.75))];
  const closingBeat = beats.at(-1);

  return [
    {
      icon: Sparkles,
      title: "定主题和参照",
      summary: stringValue(topic, "summary") || "先确定这条视频要复刻的情绪、文化符号和观看承诺。",
      checklist: compact([
        stringValue(topic, "transferable_formula") || stringValue(topic, "reusable_skeleton"),
        stringValue(account, "promise") ? `账号承诺：${stringValue(account, "promise")}` : "",
        stringValue(copy, "first_line") ? `标题先写成：${stringValue(copy, "first_line")}` : ""
      ])
    },
    {
      icon: Music2,
      title: "先定音乐和节奏线",
      summary: stringValue(music, "summary") || "先确定音乐段落，再决定素材怎么排，而不是剪完再随便铺 BGM。",
      checklist: compact([
        stringValue(music, "reference_genre") ? `音乐方向：${stringValue(music, "reference_genre")}` : "",
        stringValue(pace, "overall_curve") ? `节奏曲线：${stringValue(pace, "overall_curve")}` : "",
        stringValue(music, "reusable_skeleton")
      ])
    },
    {
      icon: MapPinned,
      title: "列拍摄素材清单",
      summary: stringValue(shot, "summary") || "把地点拆成可拍素材：大景、移动线索、人物视角、地标和记忆点。",
      checklist: compact([
        stringArrayValue(shot, "b_roll_functions").join(" / "),
        openingBeat?.reusable_pattern ? `开场素材：${openingBeat.reusable_pattern}` : "",
        climaxBeat?.reusable_pattern ? `高潮素材：${climaxBeat.reusable_pattern}` : ""
      ])
    },
    {
      icon: Clapperboard,
      title: "现场按段落拍",
      summary: stringValue(structure, "summary") || "拍摄时按结构段落收素材，避免回来只剩一堆无序空镜。",
      checklist: compact([
        stringValue(structure, "skeleton_template"),
        openingBeat?.visual_summary ? `开场要拍到：${openingBeat.visual_summary}` : "",
        closingBeat?.visual_summary ? `收尾要拍到：${closingBeat.visual_summary}` : ""
      ])
    },
    {
      icon: Scissors,
      title: "按音乐剪成成片",
      summary: stringValue(edit, "summary") || "剪辑以硬切、同类意象成组和音乐落点为主，让画面跟着旋律推进。",
      checklist: compact([
        stringValue(edit, "reusable_skeleton"),
        stringValue(shot, "cut_density") ? `镜头密度：${stringValue(shot, "cut_density")}` : "",
        beats.length > 0 ? `参考分镜：先剪 ${beats.length} 个关键段，再补齐过渡镜头。` : ""
      ])
    },
    {
      icon: Subtitles,
      title: "补字幕、标题和发布信息",
      summary: stringValue(subtitle, "summary") || "字幕和发布文案只解释必要信息，保留画面空间和情绪。",
      checklist: compact([
        stringValue(subtitle, "strategy") ? `字幕策略：${stringValue(subtitle, "strategy")}` : "",
        stringArrayValue(subtitle, "keyword_choices").length > 0 ? `关键词：${stringArrayValue(subtitle, "keyword_choices").join(" / ")}` : "",
        stringArrayValue(copy, "key_lines").length > 0 ? `正文要点：${stringArrayValue(copy, "key_lines").join(" / ")}` : ""
      ])
    }
  ];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function stringArrayValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function numberArrayValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : [];
}

function numberValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function arrayRecords(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function firstSentenceText(record: Record<string, unknown>) {
  const first = record.first_sentence;
  if (typeof first === "string") return first;
  const nested = asRecord(first);
  return stringValue(nested, "text") || stringValue(record, "first_line");
}

function stringifyCompact(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function compact(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim()));
}

function storyFunctionLabel(value: string) {
  const labels: Record<string, string> = {
    setup: "设定",
    inciting_incident: "触发",
    escalation: "升级",
    contrast: "反差",
    release: "释放",
    reflection: "反思",
    social_reintegration: "重新连接",
    payoff: "回收",
    resolution: "收束"
  };
  return labels[value] ?? (value || "故事功能");
}

function extractTimelinePoints(cards: Record<string, unknown>) {
  return Object.values(cards)
    .flatMap((payload) => normalizePayload(payload).evidence)
    .sort((a, b) => a.timestamp_sec - b.timestamp_sec)
    .map((item) => ({ timestamp_sec: item.timestamp_sec, label: item.note }));
}
