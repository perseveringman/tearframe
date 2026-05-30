import { ButtonHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={twMerge(
        "inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 active:translate-y-px disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200",
        className
      )}
      {...props}
    />
  );
}
