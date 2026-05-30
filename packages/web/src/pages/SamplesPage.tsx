import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Film, ListChecks, TerminalSquare } from "lucide-react";
import { SampleFilters, SampleFilterValue } from "../components/samples/SampleFilters";
import { SampleGrid } from "../components/samples/SampleGrid";
import { ErrorState } from "../components/shared/ErrorState";
import { LoadingSkeleton } from "../components/shared/LoadingSkeleton";
import { listSamples } from "../lib/api";

const initialFilter: SampleFilterValue = { q: "", platform: "", category: "", status: "" };

export function SamplesPage() {
  const [filters, setFilters] = useState(initialFilter);
  const samples = useQuery({
    queryKey: ["samples", filters],
    queryFn: () => listSamples(filters)
  });

  const items = samples.data?.items ?? [];

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-medium text-zinc-500">样片库</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">把值得复用的视频变成可拆解资产。</h1>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Metric icon={Database} label="样片" value={samples.data?.total ?? 0} />
                <Metric icon={Film} label="展示" value={items.length} />
                <Metric icon={ListChecks} label="完成" value={items.filter((sample) => sample.teardown_status === "done").length} />
              </div>
            </div>
          </div>

          <SampleFilters value={filters} onChange={setFilters} />
          {samples.isError ? <ErrorState message={samples.error.message} /> : null}
          {samples.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <LoadingSkeleton />
              <LoadingSkeleton />
              <LoadingSkeleton />
            </div>
          ) : (
            <SampleGrid samples={items} />
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            <h2 className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50">
              <TerminalSquare className="size-4" />
              Agent 生产流转
            </h2>
            <ol className="mt-3 space-y-2">
              <li>1. `sample.import` 爬取并导入真实 URL 或本地视频。</li>
              <li>2. `sample.preprocess` 生成 shots、transcript、frames。</li>
              <li>3. `teardown.submit_storyboard` 写入分镜分析。</li>
              <li>4. `teardown.submit_card` / `submit_relations` 完成报告和画布。</li>
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: number }) {
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
