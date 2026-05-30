import { PLATFORMS, VIDEO_CATEGORIES } from "@tearframe/shared";
import { platformLabel, statusLabel, videoCategoryLabel } from "../../lib/labels";

const TEARDOWN_STATUSES = ["pending", "running", "done", "failed"] as const;

export type SampleFilterValue = {
  q: string;
  platform: string;
  category: string;
  status: string;
};

export function SampleFilters({ value, onChange }: { value: SampleFilterValue; onChange: (value: SampleFilterValue) => void }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_180px_140px]">
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          搜索
          <input
            value={value.q}
            onChange={(event) => onChange({ ...value, q: event.target.value })}
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white"
            placeholder="标题、作者、标签"
          />
        </label>
        <Select label="平台" value={value.platform} onChange={(platform) => onChange({ ...value, platform })} options={PLATFORMS} getOptionLabel={platformLabel} />
        <Select label="类型" value={value.category} onChange={(category) => onChange({ ...value, category })} options={VIDEO_CATEGORIES} getOptionLabel={videoCategoryLabel} />
        <Select label="状态" value={value.status} onChange={(status) => onChange({ ...value, status })} options={TEARDOWN_STATUSES} getOptionLabel={statusLabel} />
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  getOptionLabel = (option) => option
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  getOptionLabel?: (option: string) => string;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white"
      >
        <option value="">全部</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {getOptionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
