import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { createCollection } from "../../lib/api";

const KINDS = [
  { value: "movie", label: "电影" },
  { value: "series", label: "剧集" },
  { value: "season", label: "单季" },
  { value: "playlist", label: "播放列表" }
] as const;

export function CreateCollectionDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    kind: "movie" as (typeof KINDS)[number]["value"],
    title: "",
    original_title: "",
    release_year: "",
    director: "",
    language: "",
    synopsis: ""
  });

  const mutation = useMutation({
    mutationFn: () =>
      createCollection({
        kind: form.kind,
        title: form.title,
        original_title: form.original_title || undefined,
        release_year: form.release_year ? Number(form.release_year) : undefined,
        director: form.director || undefined,
        language: form.language || undefined,
        synopsis: form.synopsis || undefined
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      onClose();
      onCreated?.(data.id);
    }
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">新建 Collection</h2>
          <button className="text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <form
          className="mt-4 space-y-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="类型">
            <select
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as never })}
            >
              {KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="标题（必填）">
            <Input value={form.title} onChange={(value) => setForm({ ...form, title: value })} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="原标题">
              <Input value={form.original_title} onChange={(value) => setForm({ ...form, original_title: value })} />
            </Field>
            <Field label="发行年份">
              <Input type="number" value={form.release_year} onChange={(value) => setForm({ ...form, release_year: value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="导演">
              <Input value={form.director} onChange={(value) => setForm({ ...form, director: value })} />
            </Field>
            <Field label="语言">
              <Input value={form.language} onChange={(value) => setForm({ ...form, language: value })} />
            </Field>
          </div>
          <Field label="简介">
            <textarea
              rows={3}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
              value={form.synopsis}
              onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
            />
          </Field>
          {mutation.isError ? <p className="text-xs text-red-600">{(mutation.error as Error).message}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded-md border border-zinc-200 px-3 py-1.5 dark:border-zinc-800" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="rounded-md bg-zinc-950 px-3 py-1.5 text-white dark:bg-white dark:text-zinc-950"
              disabled={!form.title.trim() || mutation.isPending}
            >
              {mutation.isPending ? "创建中..." : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, type = "text", required = false }: { value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <input
      type={type}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
    />
  );
}
