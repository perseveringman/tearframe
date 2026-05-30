import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { RelationCanvas } from "../components/canvas/RelationCanvas";
import { EmptyState } from "../components/shared/EmptyState";
import { ErrorState } from "../components/shared/ErrorState";
import { LoadingSkeleton } from "../components/shared/LoadingSkeleton";
import { getTeardown, getTeardownGraph } from "../lib/api";

export function CanvasPage() {
  const { id } = useParams();
  const teardownId = id ?? "";
  const teardown = useQuery({ queryKey: ["teardown", teardownId], queryFn: () => getTeardown(teardownId), enabled: Boolean(teardownId) });
  const graph = useQuery({ queryKey: ["teardown-graph", teardownId], queryFn: () => getTeardownGraph(teardownId), enabled: Boolean(teardownId) });

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 lg:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/teardowns/${teardownId}`} className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          <ArrowLeft className="size-4" />
          返回报告
        </Link>
        <div className="text-sm text-zinc-500">{teardown.data?.relations.length ?? 0} 条关系</div>
      </div>
      <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-500">关联画布</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">卡片、证据点、分镜和模板的关系网</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          画布现在按语义层级生成节点：卡片来自提交的分析卡，证据点来自 evidence 与 relations，分镜来自 storyboard，模板来自模板库回链。
        </p>
      </div>
      {graph.isError ? <ErrorState message={graph.error.message} /> : null}
      {graph.isLoading ? <LoadingSkeleton /> : null}
      {graph.data && graph.data.nodes.length > 0 ? <RelationCanvas graph={graph.data} /> : null}
      {!graph.isLoading && graph.data && graph.data.nodes.length === 0 ? <EmptyState title="画布还没有节点" body="提交卡片和 relations 后，这里会渲染可跳转的节点与边。" /> : null}
    </main>
  );
}
