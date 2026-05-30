import type { Sample } from "@tearframe/shared";
import { EmptyState } from "../shared/EmptyState";
import { SampleCard } from "./SampleCard";

export function SampleGrid({ samples }: { samples: Sample[] }) {
  if (samples.length === 0) return <EmptyState title="还没有样片" body="添加第一条样片后，这里会显示可过滤的样片网格。" />;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {samples.map((sample) => (
        <SampleCard key={sample.id} sample={sample} />
      ))}
    </div>
  );
}
