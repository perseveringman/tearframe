import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ExternalLink,
  FileText,
  Film,
  GitBranch,
  Heart,
  Layers3,
  MessageCircle,
  Play,
  Scissors,
  Sparkles,
  Subtitles,
  TerminalSquare,
  UserRound,
  type LucideIcon
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { Sample } from "@tearframe/shared";
import { EmptyState } from "../components/shared/EmptyState";
import { ErrorState } from "../components/shared/ErrorState";
import { getSample, listSampleResources, listTeardowns, mediaUrl, type ResourceRecord, type ResourceType, type TeardownRecord } from "../lib/api";
import { platformLabel, statusLabel, videoCategoryLabel } from "../lib/labels";

type ResourceDefinition = {
  type: ResourceType;
  icon: LucideIcon;
  label: string;
  body: string;
  command: string;
};

const resourceTypes: ResourceDefinition[] = [
  {
    type: "shots",
    icon: Scissors,
    label: "镜头边界",
    body: "拆出每个 shot 的起止点，是后续分镜和关键帧的时间轴。",
    command: "sample.preprocess({ type: \"shots\" })"
  },
  {
    type: "transcript",
    icon: Subtitles,
    label: "字幕逐字稿",
    body: "优先复用平台字幕，缺失时回退 Whisper，给文案卡片提供证据。",
    command: "sample.preprocess({ type: \"transcript\" })"
  },
  {
    type: "frames",
    icon: Layers3,
    label: "关键帧证据",
    body: "基于镜头中点抽帧，让 agent 在视觉分析里能引用画面。",
    command: "sample.preprocess({ type: \"frames\" })"
  }
];

const priorityLabels: Record<Sample["priority"], string> = {
  low: "低优先",
  medium: "中优先",
  high: "高优先"
};

export function SampleDetailPage() {
  const { id } = useParams();
  const sampleId = id ?? "";
  const sample = useQuery({ queryKey: ["sample", sampleId], queryFn: () => getSample(sampleId), enabled: Boolean(sampleId) });
  const resources = useQuery({ queryKey: ["resources", sampleId], queryFn: () => listSampleResources(sampleId), enabled: Boolean(sampleId) });
  const teardowns = useQuery({ queryKey: ["teardowns", { sample_id: sampleId }], queryFn: () => listTeardowns({ sample_id: sampleId }), enabled: Boolean(sampleId) });

  if (sample.isError) return <main className="mx-auto max-w-[1200px] px-4 py-6 lg:px-6"><ErrorState message={sample.error.message} /></main>;

  const current = sample.data;
  const resourceList = resources.data?.resources ?? [];
  const teardownList = teardowns.data?.items ?? [];
  const resourceByType = new Map(resourceList.map((resource) => [resource.resource_type, resource]));
  const readyResources = resourceTypes.filter((item) => resourceByType.get(item.type)?.status === "done").length;
  const stage = getStage(current, readyResources, teardownList);
  const nextStep = getNextStep(sampleId, current, resourceByType, teardownList);
  const latestTeardown = teardownList[0];

  return (
    <main className="mx-auto flex max-w-[1500px] flex-col gap-2 px-4 py-3 lg:h-[100dvh] lg:overflow-hidden lg:px-5">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:text-zinc-400 dark:hover:text-zinc-50">
          <ArrowLeft className="size-4" />
          返回样片库
        </Link>
        {current?.source_url ? (
          <a href={current.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900">
            原始链接
            <ExternalLink className="size-4" />
          </a>
        ) : null}
      </div>

      <section className="relative shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={current?.teardown_status ?? "pending"} />
              <CompactTag>{current ? platformLabel(current.platform) : "读取中"}</CompactTag>
              {current?.category ? <CompactTag>{videoCategoryLabel(current.category)}</CompactTag> : null}
              {current ? <CompactTag>{priorityLabels[current.priority]}</CompactTag> : null}
              {(current?.sub_tags ?? []).slice(0, 3).map((tag) => <CompactTag key={tag}>{tag}</CompactTag>)}
            </div>
            <h1 className="mt-2 truncate text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-2xl">
              {current?.title ?? "读取样片中"}
            </h1>
            <div className="mt-2 grid gap-1.5 text-sm text-zinc-600 dark:text-zinc-400 sm:grid-cols-2 xl:grid-cols-4">
              <Fact icon={UserRound} label="作者" value={current?.author ?? current?.author_handle ?? "未知作者"} />
              <Fact icon={Clock3} label="时长" value={formatDuration(current?.duration_sec)} />
              <Fact icon={Film} label="画幅" value={current?.resolution ?? "未识别"} />
              <Fact icon={CalendarDays} label="入库" value={formatDate(current?.added_at)} />
            </div>
          </div>
          <StagePanel stage={stage} readyResources={readyResources} teardownCount={teardownList.length} />
        </div>
      </section>

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.82fr)_360px]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
            <div>
              <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">原始样片</h2>
              <p className="mt-0.5 text-xs text-zinc-500">拉片结论都回到这里校验。</p>
            </div>
            {current?.author_handle ? (
              <Link to={`/authors/${encodeURIComponent(current.author_handle)}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900">
                <UserRound className="size-4" />
                作者档案
              </Link>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-2.5">
            {current?.local_path ? (
              <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-zinc-950 ring-1 ring-zinc-950/10 dark:ring-white/10">
                <video src={mediaUrl(current.local_path)} controls className="h-full w-full bg-zinc-950 object-contain" />
              </div>
            ) : (
              <div className="min-h-0 flex-1">
                <EmptyState title="源文件尚未保存" body="导入器还没有拿到可预处理的视频文件。" />
              </div>
            )}
            <MetricStrip current={current} />
          </div>
        </section>

        <ResourcePipeline resourceByType={resourceByType} readyResources={readyResources} />

        <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <NextStepPanel nextStep={nextStep} latestTeardown={latestTeardown} />
          <TeardownPanel teardowns={teardownList} />
        </aside>
      </div>
    </main>
  );
}

function StagePanel({ stage, readyResources, teardownCount }: { stage: Stage; readyResources: number; teardownCount: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white/80 p-2.5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">当前阶段</p>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{stage.title}</h2>
          <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{stage.body}</p>
        </div>
        <div className={classNames("flex size-8 shrink-0 items-center justify-center rounded-lg", stage.iconClass)}>
          <stage.icon className="size-4" />
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${stage.percent}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <StageMetric label="源文件" value={stage.sourceReady ? "就绪" : "缺失"} active={stage.sourceReady} />
        <StageMetric label="资源" value={`${readyResources}/3`} active={readyResources === resourceTypes.length} />
        <StageMetric label="拉片" value={`${teardownCount}`} active={teardownCount > 0} />
      </div>
    </div>
  );
}

function StageMetric({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={classNames("rounded-lg border px-2 py-1", active ? "border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-900/70 dark:bg-cyan-950/40 dark:text-cyan-100" : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500")}>
      <div className="text-[10px] font-medium">{label}</div>
      <div className="mt-0.5 font-mono text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ResourcePipeline({ resourceByType, readyResources }: { resourceByType: Map<ResourceType, ResourceRecord>; readyResources: number }) {
  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50">
            <BadgeCheck className="size-4 text-cyan-600 dark:text-cyan-300" />
            资源流水线
          </h2>
          <p className="mt-0.5 text-xs leading-5 text-zinc-500">agent 拉片前需要这三类资源。</p>
        </div>
        <span className="rounded-lg bg-zinc-100 px-2.5 py-1.5 font-mono text-xs font-semibold text-zinc-600 tabular-nums dark:bg-zinc-900 dark:text-zinc-300">
          {readyResources}/{resourceTypes.length} ready
        </span>
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {resourceTypes.map((item, index) => {
          const resource = resourceByType.get(item.type);
          const status = resource?.status ?? "missing";
          const Icon = item.icon;
          return (
            <article key={item.type} className={classNames("relative rounded-lg border p-2.5 transition", status === "done" ? "border-cyan-200 bg-cyan-50/70 dark:border-cyan-900/70 dark:bg-cyan-950/20" : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className={classNames("flex size-7 shrink-0 items-center justify-center rounded-lg", statusIconClass(status))}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-zinc-500 tabular-nums">0{index + 1}</div>
                    <h3 className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">{item.label}</h3>
                  </div>
                </div>
                <StatusPill status={status} />
              </div>
              <p className="mt-1.5 line-clamp-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{item.body}</p>
              <div className="mt-1.5 truncate rounded-md bg-white px-2 py-1 font-mono text-[10px] text-zinc-500 dark:bg-zinc-950/70">
                {resource?.generator ?? item.command}
              </div>
              {resource?.error ? <p className="mt-2 line-clamp-2 rounded-md bg-red-50 px-2 py-1.5 text-xs leading-5 text-red-700 dark:bg-red-950/30 dark:text-red-300">{resource.error}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function NextStepPanel({ nextStep, latestTeardown }: { nextStep: NextStep; latestTeardown?: TeardownRecord }) {
  return (
    <section className="shrink-0 rounded-xl border border-zinc-200 bg-zinc-950 p-2.5 text-white shadow-sm dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">建议下一步</p>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight">{nextStep.title}</h2>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{nextStep.body}</p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400 text-zinc-950">
          <nextStep.icon className="size-4" />
        </div>
      </div>
      <pre className="mt-2 max-h-20 overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] p-2.5 text-[11px] leading-5 text-zinc-200">{nextStep.commands.join("\n")}</pre>
      {latestTeardown ? (
        <Link to={`/teardowns/${latestTeardown.id}`} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 active:translate-y-px">
          打开最近拉片
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}

function TeardownPanel({ teardowns }: { teardowns: TeardownRecord[] }) {
  const visibleTeardowns = teardowns.slice(0, 3);
  const overflowCount = Math.max(0, teardowns.length - visibleTeardowns.length);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50">
          <Sparkles className="size-4 text-cyan-600 dark:text-cyan-300" />
          拉片产物
        </h2>
        <span className="font-mono text-xs text-zinc-500 tabular-nums">{teardowns.length} runs</span>
      </div>
      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-hidden">
        {teardowns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            资源备齐后，agent 生成的分镜、卡片和模板会出现在这里。
          </div>
        ) : null}
        {visibleTeardowns.map((teardown) => (
          <Link key={teardown.id} to={`/teardowns/${teardown.id}`} className="group block rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 transition hover:border-cyan-300 hover:bg-cyan-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-cyan-900 dark:hover:bg-cyan-950/20">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">{teardown.lens ?? "generic teardown"}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{formatDateTime(teardown.started_at)}</div>
              </div>
              <StatusPill status={teardown.status} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px] text-zinc-500">
              <RunMetric icon={FileText} label="卡片" value={Object.keys(teardown.cards).length} />
              <RunMetric icon={Boxes} label="模板" value={teardown.templates.length} />
              <RunMetric icon={GitBranch} label="分镜" value={teardown.storyboard.length} />
            </div>
          </Link>
        ))}
        {overflowCount > 0 ? <p className="px-1 text-xs text-zinc-500">还有 {overflowCount} 个拉片记录未展示</p> : null}
      </div>
    </section>
  );
}

function SampleNotes({ current }: { current?: Sample }) {
  const tags = current?.sub_tags ?? [];
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-5">
      <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">样片线索</h2>
      <div className="mt-4 grid gap-3">
        <InfoLine label="平台 ID" value={current?.source_video_id ?? current?.id ?? "--"} />
        <InfoLine label="发布时间" value={formatDate(current?.published_at)} />
        <InfoLine label="语言" value={current?.language ?? "未标注"} />
      </div>
      {tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MetricStrip({ current }: { current?: Sample }) {
  const metrics = [
    { icon: Heart, label: "赞", value: current?.metrics.likes },
    { icon: Boxes, label: "藏", value: current?.metrics.collects },
    { icon: MessageCircle, label: "评", value: current?.metrics.comments },
    { icon: Play, label: "拆解", value: current?.teardown_count }
  ];

  return (
    <div className="mt-2 grid shrink-0 grid-cols-2 gap-1.5 md:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
            <metric.icon className="size-3.5" />
            {metric.label}
          </div>
          <div className="mt-1 font-mono text-base font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{formatCount(metric.value)}</div>
        </div>
      ))}
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-zinc-200 bg-white/70 px-2 py-1 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100">{value}</div>
    </div>
  );
}

function RunMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <span className="inline-flex items-center justify-center gap-1 rounded-md bg-white px-1.5 py-1 font-mono tabular-nums dark:bg-zinc-950">
      <Icon className="size-3.5" />
      {value} {label}
    </span>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="truncate font-medium text-zinc-800 dark:text-zinc-200">{value}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={classNames("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", statusPillClass(status))}>
      {statusIcon(status)}
      {statusText(status)}
    </span>
  );
}

function CompactTag({ children }: { children: string }) {
  return (
    <span className="rounded-md border border-zinc-200 bg-white/75 px-2 py-0.5 text-[11px] font-medium text-zinc-600 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-400">
      {children}
    </span>
  );
}

type Stage = {
  title: string;
  body: string;
  percent: number;
  sourceReady: boolean;
  icon: LucideIcon;
  iconClass: string;
};

function getStage(current: Sample | undefined, readyResources: number, teardowns: TeardownRecord[]): Stage {
  const sourceReady = Boolean(current?.local_path);
  if (!current) {
    return {
      title: "读取样片",
      body: "正在从本地库加载样片、资源和拉片记录。",
      percent: 10,
      sourceReady: false,
      icon: CircleDashed,
      iconClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
    };
  }
  if (!sourceReady) {
    return {
      title: "等待源文件",
      body: "样片元数据已经入库，但还没有可播放的本地视频。",
      percent: 24,
      sourceReady,
      icon: AlertTriangle,
      iconClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
    };
  }
  if (readyResources < resourceTypes.length) {
    return {
      title: "补齐预处理资源",
      body: `已完成 ${readyResources}/${resourceTypes.length} 类资源，缺的资源会限制 agent 的证据引用。`,
      percent: 40 + readyResources * 16,
      sourceReady,
      icon: CircleDashed,
      iconClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300"
    };
  }
  if (teardowns.length === 0) {
    return {
      title: "可以开始拉片",
      body: "源文件、镜头、字幕和关键帧都已经准备好，下一步是让 agent 生成分镜和卡片。",
      percent: 82,
      sourceReady,
      icon: Sparkles,
      iconClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300"
    };
  }
  return {
    title: "已有可读报告",
    body: "这条样片已经产出拉片记录，可以继续查看报告、模板或关联画布。",
    percent: 100,
    sourceReady,
    icon: CheckCircle2,
    iconClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
  };
}

type NextStep = {
  title: string;
  body: string;
  commands: string[];
  icon: LucideIcon;
};

function getNextStep(sampleId: string, current: Sample | undefined, resourceByType: Map<ResourceType, ResourceRecord>, teardowns: TeardownRecord[]): NextStep {
  if (!current) {
    return {
      title: "等待样片加载",
      body: "加载完成后这里会切换成具体的资源或拉片动作。",
      commands: [`sample.get_resources({ sample_id: "${sampleId}" })`],
      icon: CircleDashed
    };
  }

  const failed = resourceTypes.find((item) => resourceByType.get(item.type)?.status === "failed");
  if (failed) {
    return {
      title: `重新生成${failed.label}`,
      body: "有资源生成失败，先修复失败项，再继续拆解。",
      commands: [`sample.preprocess({ sample_id: "${sampleId}", type: "${failed.type}" })`, `sample.get_resources({ sample_id: "${sampleId}" })`],
      icon: AlertTriangle
    };
  }

  const running = resourceTypes.find((item) => resourceByType.get(item.type)?.status === "running");
  if (running) {
    return {
      title: `${running.label}处理中`,
      body: "先确认预处理是否完成，完成后再进入拉片。",
      commands: [`sample.get_resources({ sample_id: "${sampleId}" })`],
      icon: CircleDashed
    };
  }

  const missing = resourceTypes.find((item) => resourceByType.get(item.type)?.status !== "done");
  if (missing) {
    return {
      title: `生成${missing.label}`,
      body: "先把基础资源补齐，后面的分镜、卡片和模板才有可靠证据。",
      commands: [`sample.preprocess({ sample_id: "${sampleId}", type: "${missing.type}" })`, `sample.get_resources({ sample_id: "${sampleId}" })`],
      icon: TerminalSquare
    };
  }

  if (teardowns.length === 0) {
    return {
      title: "启动第一次拉片",
      body: "资源已经齐了，可以让 agent 创建报告并提交分镜、卡片和关系。",
      commands: [`teardown.start({ sample_id: "${sampleId}" })`, "teardown.submit_storyboard({ teardown_id, beats })", "teardown.submit_card({ teardown_id, type, payload })"],
      icon: Sparkles
    };
  }

  return {
    title: "查看或补全拉片",
    body: "已有报告可以阅读；如果要继续训练模板，可补交模板和关系。",
    commands: [`teardown.get({ teardown_id: "${teardowns[0]?.id ?? "teardown_id"}" })`, "teardown.submit_template({ teardown_id, template })", "teardown.submit_relations({ teardown_id, relations })"],
    icon: CheckCircle2
  };
}

function statusText(status: string) {
  const copy: Record<string, string> = {
    pending: "待处理",
    running: "处理中",
    done: "已完成",
    failed: "失败",
    missing: "未生成"
  };
  return copy[status] ?? statusLabel(status);
}

function statusPillClass(status: string) {
  if (status === "done") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (status === "running") return "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300";
  if (status === "failed") return "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300";
  if (status === "missing") return "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400";
  return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
}

function statusIconClass(status: string) {
  if (status === "done") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
  if (status === "running") return "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300";
  if (status === "failed") return "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300";
  return "bg-zinc-100 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400";
}

function statusIcon(status: string) {
  if (status === "done") return <CheckCircle2 className="size-3.5" />;
  if (status === "failed") return <AlertTriangle className="size-3.5" />;
  return <CircleDashed className="size-3.5" />;
}

function formatDuration(value?: number | null) {
  if (!value || value <= 0) return "未取时长";
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

function formatDate(value?: string | null) {
  if (!value) return "未记录";
  return value.slice(0, 10);
}

function formatDateTime(value?: string | null) {
  if (!value) return "未记录";
  return value.replace("T", " ").slice(0, 16);
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
