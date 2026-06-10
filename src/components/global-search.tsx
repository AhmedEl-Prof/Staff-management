"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FolderKanban, ListTodo, Loader2, Search, Users, X } from "lucide-react";
import {
  globalSearch,
  type SearchHit,
  type SearchResults,
} from "@/app/(app)/search-actions";

const EMPTY: SearchResults = { projects: [], tasks: [], employees: [] };

// Global search (Ctrl/Cmd+K): a trigger button + modal palette searching
// projects, tasks and employees through an RLS-scoped server action. Mounted
// twice (sidebar + mobile top bar); only the sidebar instance registers the
// hotkey so a keypress opens a single dialog.
export function GlobalSearch({ withHotkey = false }: { withHotkey?: boolean }) {
  const t = useTranslations("search");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults(EMPTY);
  }, []);

  // Hotkey (Ctrl/Cmd+K) + Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (withHotkey && e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [withHotkey, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function onChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults(EMPTY);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        setResults(await globalSearch(value));
      });
    }, 250);
  }

  function go(hit: SearchHit) {
    close();
    router.push(hit.href);
  }

  const hasResults =
    results.projects.length + results.tasks.length + results.employees.length >
    0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("open")}
        title={`${t("open")} (Ctrl+K)`}
        className="hover:bg-muted inline-flex size-10 items-center justify-center rounded-md sm:size-9"
      >
        <Search className="size-5" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[max(4rem,env(safe-area-inset-top))]"
          onClick={close}
        >
          <div
            role="dialog"
            aria-label={t("open")}
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => onChange(e.target.value)}
                placeholder={t("placeholder")}
                className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {pending ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : null}
              <button
                type="button"
                onClick={close}
                aria-label={t("closeLabel")}
                className="hover:bg-muted inline-flex size-8 shrink-0 items-center justify-center rounded-md"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {q.trim().length < 2 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  {t("hint")}
                </p>
              ) : !hasResults && !pending ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </p>
              ) : (
                <>
                  <ResultGroup
                    title={t("projects")}
                    icon={<FolderKanban className="size-4" />}
                    hits={results.projects}
                    onSelect={go}
                  />
                  <ResultGroup
                    title={t("tasks")}
                    icon={<ListTodo className="size-4" />}
                    hits={results.tasks}
                    onSelect={go}
                  />
                  <ResultGroup
                    title={t("employees")}
                    icon={<Users className="size-4" />}
                    hits={results.employees}
                    onSelect={go}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ResultGroup({
  title,
  icon,
  hits,
  onSelect,
}: {
  title: string;
  icon: React.ReactNode;
  hits: SearchHit[];
  onSelect: (hit: SearchHit) => void;
}) {
  if (!hits.length) return null;
  return (
    <div className="mb-2">
      <p className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        {title}
      </p>
      {hits.map((hit) => (
        <button
          key={hit.id}
          type="button"
          onClick={() => onSelect(hit)}
          className="hover:bg-muted flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-start text-sm"
        >
          <span className="truncate">{hit.label}</span>
          {hit.sub ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {hit.sub}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
