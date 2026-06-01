import { Boxes, FileJson2, Film, Library, PanelLeftClose, Search } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "样片库", icon: Library },
  { to: "/collections", label: "电影聚合", icon: Film },
  { to: "/templates", label: "模板库", icon: Boxes },
  { to: "/protocol", label: "MCP 协议", icon: FileJson2 }
];

export function AppShell() {
  return (
    <div className="min-h-[100dvh] bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-zinc-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 lg:block">
        <div className="flex h-12 items-center gap-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-950 text-sm font-black text-white dark:bg-white dark:text-zinc-950">
            TF
          </div>
          <div>
            <p className="text-sm font-semibold">Tearframe</p>
            <p className="text-xs text-zinc-500">Local teardown studio</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          <Search className="size-4 shrink-0" />
          <span className="truncate">样片、模板、作者风格</span>
        </div>
        <nav className="mt-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  [
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition active:translate-y-px",
                    isActive
                      ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                  ].join(" ")
                }
              >
                <Icon className="size-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          UI 只渲染 API 数据；分析由 MCP/agent 提交，资源由本地流水线复用。
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 lg:hidden">
          <div className="flex items-center gap-3 lg:hidden">
            <PanelLeftClose className="size-5 text-zinc-500" />
            <span className="font-semibold">Tearframe</span>
          </div>
          <nav className="flex items-center gap-1 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} end={item.to === "/"} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900" title={item.label}>
                  <Icon className="size-5" />
                </NavLink>
              );
            })}
          </nav>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
