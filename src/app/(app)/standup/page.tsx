import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { AiPanel } from "@/components/ai-panel";
import { aiConfigured } from "@/lib/ai";
import { StandupForm } from "./standup-form";
import { summarizeStandup } from "./ai-actions";
import type { StandupResponseRow, StandupMood } from "@/types/database";

const MOOD_VARIANT: Record<
  StandupMood,
  "success" | "secondary" | "muted" | "destructive"
> = {
  great: "success",
  good: "success",
  okay: "secondary",
  stressed: "muted",
  blocked: "destructive",
};

export default async function StandupPage() {
  const { id: userId, profile } = await requireUser();
  const t = await getTranslations("standup");
  const tAi = await getTranslations("ai");
  const today = new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("standup_responses")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  const isManager =
    profile.role === "super_admin" || profile.role === "team_leader";

  // Team standups for today (RLS already restricts standup_responses to
  // self + people the caller manages, so this is safe via the RLS client).
  let teamRows: StandupResponseRow[] = [];
  const nameById = new Map<string, string>();
  if (isManager) {
    const { data } = await supabase
      .from("standup_responses")
      .select("*")
      .eq("date", today)
      .order("submitted_at", { ascending: false });
    teamRows = (data ?? []) as StandupResponseRow[];

    if (teamRows.length) {
      const admin = createAdminClient();
      const ids = [...new Set(teamRows.map((r) => r.user_id))];
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, arabic_name, full_name")
        .in("id", ids);
      (profiles ?? []).forEach((p) =>
        nameById.set(p.id, p.arabic_name || p.full_name || p.id),
      );
    }
  }

  const moodLabel = (m: StandupMood) =>
    t(`mood${m.charAt(0).toUpperCase()}${m.slice(1)}`);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <StandupForm existing={(mine as StandupResponseRow) ?? null} />

      {isManager ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("teamToday")}</h2>
          {aiConfigured() && teamRows.length > 0 ? (
            <AiPanel
              action={summarizeStandup}
              title={t("aiSummaryTitle")}
              cta={tAi("generate")}
            />
          ) : null}
          {teamRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noTeamUpdates")}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {teamRows.map((r) => (
                <li key={r.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {nameById.get(r.user_id) ?? r.user_id}
                    </span>
                    {r.mood ? (
                      <Badge variant={MOOD_VARIANT[r.mood]}>
                        {moodLabel(r.mood)}
                      </Badge>
                    ) : null}
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t("yesterday")}
                      </dt>
                      <dd>{r.yesterday_work || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t("today")}
                      </dt>
                      <dd>{r.today_plan || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t("blockersLabel")}
                      </dt>
                      <dd
                        className={r.blockers ? "text-destructive" : undefined}
                      >
                        {r.blockers || "—"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
