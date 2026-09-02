import { useEffect, useMemo } from "react";
import { Command } from "cmdk";
import { Search, X } from "lucide-react";
import { useGlobalSearch } from "@app/providers/GlobalSearchProvider";
import { ICON_MAP } from "@app/shell/sidebarConfig";
import { cn } from "@shared/lib/utils";
import { useLocalization } from "@app/providers/LocalizationProvider";

const GROUP_LABELS: Record<string, string> = {
  navigation: "التنقل",
  commands: "الأوامر",
  tabs: "التبويبات المفتوحة",
};

export function GlobalSearch() {
  const { isOpen, query, setQuery, closeSearch, results, activateResult } = useGlobalSearch();
  const { t } = useLocalization();

  const groupedResults = useMemo(() => {
    return results.reduce<Record<string, typeof results>>((acc, result) => {
      acc[result.group] = acc[result.group] || [];
      acc[result.group].push(result);
      return acc;
    }, {});
  }, [results]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSearch, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm">
      <div className="mx-auto mt-24 w-full max-w-3xl px-4">
        <Command
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          shouldFilter={false}
          dir="rtl"
        >
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
            <Search className="h-5 w-5 text-slate-400" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={t("placeholder", { namespace: "search" })}
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              autoFocus
            />
            <button
              type="button"
              onClick={closeSearch}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label={t("close", { namespace: "common", fallback: "إغلاق" })}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto p-2">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-slate-500">
                <Search className="h-10 w-10 opacity-40" />
                <p className="text-sm font-bold">{t("noResults", { namespace: "search" })}</p>
                <p className="text-xs">{t("hint", { namespace: "search" })}</p>
              </div>
            ) : (
              Object.entries(groupedResults).map(([group, items]) => (
                <Command.Group
                  key={group}
                  heading={GROUP_LABELS[group] || group}
                  className="mb-3 overflow-hidden rounded-xl bg-slate-50/70 p-1 text-slate-700"
                >
                  {items.map((result) => {
                    const Icon = result.icon ? (ICON_MAP[result.icon] ?? Search) : Search;
                    return (
                      <Command.Item
                        key={result.id}
                        value={`${result.title} ${result.subtitle || ""} ${(result.keywords || []).join(" ")}`}
                        onSelect={() => activateResult(result)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none",
                          "data-[selected=true]:bg-white data-[selected=true]:shadow-sm",
                        )}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200/70 text-slate-600">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 text-right">
                          <span className="block truncate font-bold text-slate-800">{result.title}</span>
                          {result.subtitle && (
                            <span className="block truncate text-xs text-slate-500">{result.subtitle}</span>
                          )}
                        </span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))
            )}
          </Command.List>

          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
            <span>{t("hint", { namespace: "search" })}</span>
            <span>ESC</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
