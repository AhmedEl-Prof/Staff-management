import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { MemberWorkload, WorkloadZone } from "@/lib/workload";

const ZONE_COLOR: Record<WorkloadZone, string> = {
  green: "var(--success, #16a34a)",
  yellow: "#ca8a04",
  red: "var(--destructive)",
};

const ZONE_DOT: Record<WorkloadZone, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

// Server component rendering each member's capacity bar plus simple
// rebalancing suggestions: pair the most overloaded members with those who
// have the most spare capacity.
export async function WorkloadWidget({
  workloads,
}: {
  workloads: MemberWorkload[];
}) {
  const t = await getTranslations("workload");

  const zoneLabel: Record<WorkloadZone, string> = {
    green: t("available"),
    yellow: t("nearCapacity"),
    red: t("overloaded"),
  };

  const overloaded = workloads.filter((w) => w.zone === "red");
  const available = workloads
    .filter((w) => w.zone === "green")
    .sort((a, b) => a.percent - b.percent);

  // Pair each overloaded member with an available one (round-robin).
  const suggestions = overloaded.map((from, i) => ({
    from: from.name,
    to: available[i % Math.max(available.length, 1)]?.name ?? null,
  }));

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b p-5">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>

      {workloads.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4 p-5">
          {workloads.map((w) => (
            <li key={w.userId}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{w.name}</span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: ZONE_COLOR[w.zone] }}
                >
                  {w.percent}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(w.percent, 100)}%`,
                    background: ZONE_COLOR[w.zone],
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {ZONE_DOT[w.zone]} {zoneLabel[w.zone]} · {w.activeTasks}{" "}
                {t("tasks")} · {w.assignedHours}/{w.weeklyHours} {t("hours")}
              </p>
            </li>
          ))}
        </ul>
      )}

      {workloads.length > 0 ? (
        <div className="border-t p-5">
          <h3 className="mb-2 text-sm font-semibold">
            {t("suggestionsTitle")}
          </h3>
          {suggestions.length === 0 || available.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("noSuggestions")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {suggestions.map(
                (s, i) =>
                  s.to && (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant="destructive">{s.from}</Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="success">{s.to}</Badge>
                    </li>
                  ),
              )}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
