import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "../components/shared/EmptyState";
import { ErrorState } from "../components/shared/ErrorState";
import { ShotAnalysisTable, type FrameData, type ShotData } from "../components/teardown/ShotAnalysisTable";
import { VideoPlayer } from "../components/teardown/VideoPlayer";
import { getSample, getTeardown, listSampleResources, mediaUrl } from "../lib/api";
import { usePlayerStore } from "../stores/playerStore";

export function ShotReviewPage() {
  const { id } = useParams();
  const teardownId = id ?? "";
  const teardown = useQuery({ queryKey: ["teardown", teardownId], queryFn: () => getTeardown(teardownId), enabled: Boolean(teardownId) });
  const sampleId = teardown.data?.sample_id ?? "";
  const sample = useQuery({ queryKey: ["sample", sampleId], queryFn: () => getSample(sampleId), enabled: Boolean(sampleId) });
  const resources = useQuery({ queryKey: ["resources", sampleId], queryFn: () => listSampleResources(sampleId), enabled: Boolean(sampleId) });
  const currentTime = usePlayerStore((state) => state.currentTime);

  if (teardown.isError) {
    return (
      <main className="min-h-[100dvh] bg-zinc-950 p-4 text-zinc-50">
        <ErrorState message={teardown.error.message} />
      </main>
    );
  }

  const record = teardown.data;
  const framesResource = resources.data?.resources.find((resource) => resource.resource_type === "frames");
  const shotsResource = resources.data?.resources.find((resource) => resource.resource_type === "shots");
  const frames = Array.isArray(framesResource?.data)
    ? (framesResource.data as FrameData[]).map((frame) => ({ ...frame, path: mediaUrl(frame.path) ?? frame.path }))
    : [];
  const shots = Array.isArray(shotsResource?.data) ? (shotsResource.data as ShotData[]) : [];

  return (
    <main className="h-[100dvh] overflow-hidden bg-zinc-950 text-zinc-50">
      <div className="grid h-full min-h-0 grid-rows-[42dvh_minmax(0,1fr)] lg:grid-cols-[minmax(360px,38vw)_minmax(0,1fr)] lg:grid-rows-1">
        <section className="relative min-h-0 min-w-0 overflow-hidden border-b border-white/10 bg-black lg:border-b-0 lg:border-r">
          <div className="absolute left-3 right-3 top-3 z-10 flex items-start justify-between gap-3">
            <Link
              to={record ? `/teardowns/${record.id}` : "/"}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/55 px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white hover:text-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 active:translate-y-px"
            >
              <ArrowLeft className="size-4" />
              返回报告
            </Link>
            <div className="hidden max-w-[52%] items-center gap-2 rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-xs font-medium text-zinc-200 backdrop-blur sm:flex">
              <Clapperboard className="size-4 text-cyan-300" />
              <span className="truncate">{sample.data?.title ?? "逐 shot 模式"}</span>
            </div>
          </div>
          {sample.data?.local_path ? (
            <VideoPlayer src={mediaUrl(sample.data.local_path)} className="h-full max-h-none w-full rounded-none bg-black" />
          ) : (
            <div className="flex h-full items-center justify-center p-4">
              <EmptyState title="源文件尚未保存" body="导入器还没有拿到可播放的视频文件。" />
            </div>
          )}
        </section>

        <section className="min-h-0 min-w-0 overflow-hidden bg-zinc-950 p-2 sm:p-3">
          {record ? (
            <ShotAnalysisTable beats={record.storyboard} shots={shots} frames={frames} resolution={sample.data?.resolution} currentTime={currentTime} fill dense />
          ) : (
            <div className="h-full rounded-lg border border-zinc-800 bg-zinc-950">
              <EmptyState title="正在读取逐 shot 解读" body="拉片数据加载后，这里会显示完整镜头表格。" />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
