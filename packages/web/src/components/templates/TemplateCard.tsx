import { Link } from "react-router-dom";
import type { TemplateRecord } from "../../lib/api";

export function TemplateCard({ template }: { template: TemplateRecord }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">{template.title}</h3>
          <p className="mt-1 text-xs text-zinc-500">{template.type} / L{template.level}</p>
        </div>
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{template.source_teardowns.length} 来源</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-400">{template.body_md}</p>
      {template.source_teardowns[0] ? (
        <Link to={`/teardowns/${template.source_teardowns[0]}`} className="mt-4 inline-flex text-sm font-medium text-zinc-950 hover:underline dark:text-zinc-50">
          查看来源拉片
        </Link>
      ) : null}
    </article>
  );
}
