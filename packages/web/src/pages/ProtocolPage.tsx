import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileJson2, Workflow } from "lucide-react";
import { EmptyState } from "../components/shared/EmptyState";
import { ErrorState } from "../components/shared/ErrorState";
import { listMcpTools, McpTool } from "../lib/api";

const workflow = [
  "source.crawl 探测源信息",
  "sample.import 或 sample.list 定位样片",
  "sample.get_resources 检查可复用资源",
  "sample.preprocess 或 sample.upload_resource 补齐资源",
  "teardown.start 创建拉片任务",
  "teardown.submit_storyboard 写入每个 shot 的详细解读表",
  "teardown.submit_card / submit_template / submit_relations 提交产物",
  "teardown.finalize 完成并进入 UI 聚合"
];

export function ProtocolPage() {
  const [q, setQ] = useState("");
  const tools = useQuery({ queryKey: ["mcp-tools"], queryFn: listMcpTools });
  const filtered = useMemo(() => {
    const normalized = q.trim().toLowerCase();
    const items = tools.data?.tools ?? [];
    if (!normalized) return items;
    return items.filter((tool) => `${tool.name} ${tool.description}`.toLowerCase().includes(normalized));
  }, [q, tools.data?.tools]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-500">MCP 协议</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">给外部 agent 的生产级拉片契约。</h1>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              搜索工具
              <input value={q} onChange={(event) => setQ(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white" />
            </label>
          </div>
          {tools.isError ? <ErrorState message={tools.error.message} /> : null}
          {filtered.length === 0 ? <EmptyState title="没有匹配的工具" /> : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((tool) => <ToolCard key={tool.name} tool={tool} />)}
          </div>
        </section>
        <aside className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="flex items-center gap-2 font-semibold"><Workflow className="size-4" />推荐工作流</h2>
            <ol className="mt-3 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {workflow.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            <h2 className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50"><FileJson2 className="size-4" />协议原则</h2>
            <p className="mt-3">MCP 只接收结构化输入，所有卡片经 schema 校验，UI 不调用 LLM，也不解析视频。</p>
            <p className="mt-3">逐镜头解读必须覆盖 shots 中的每一个 shot，并提交关键帧、景别、画面内容、旁白、背景音、摄像机角度和构图解读，详情页会生成可点击跳播表格。</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ToolCard({ tool }: { tool: McpTool }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-sm font-semibold text-zinc-950 dark:text-zinc-50">{tool.name}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{tool.description}</p>
        </div>
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{tool.name.split(".")[0]}</span>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium text-zinc-500">inputSchema</summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs leading-5 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {JSON.stringify(tool.inputSchema, null, 2)}
        </pre>
      </details>
    </article>
  );
}
