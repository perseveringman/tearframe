import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CARD_TYPES } from "@tearframe/shared";
import { TemplateCard } from "../components/templates/TemplateCard";
import { EmptyState } from "../components/shared/EmptyState";
import { ErrorState } from "../components/shared/ErrorState";
import { listTemplates } from "../lib/api";

export function TemplatesPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const templates = useQuery({ queryKey: ["templates", { q, type }], queryFn: () => listTemplates({ q, type }) });

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-500">模板库</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">把单条拉片沉淀成下一条视频能直接填空的骨架。</h1>
      </div>
      <div className="mt-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          搜索
          <input value={q} onChange={(event) => setQ(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white" />
        </label>
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          卡片类型
          <select value={type} onChange={(event) => setType(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white">
            <option value="">全部</option>
            {CARD_TYPES.map((cardType) => <option key={cardType} value={cardType}>{cardType}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4">
        {templates.isError ? <ErrorState message={templates.error.message} /> : null}
        {templates.data?.items.length === 0 ? <EmptyState title="模板库为空" body="agent 通过 teardown.submit_template 提交模板后，这里会按类型聚合展示。" /> : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.data?.items.map((template) => <TemplateCard key={template.id} template={template} />)}
        </div>
      </div>
    </main>
  );
}
