import { getTranslations } from "next-intl/server";
import { Trophy, Medal, Award, Star } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getMonthlyLeaderboard,
  getUserTotalPoints,
  POINTS,
} from "@/lib/gamification";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Maps a stored badge icon name to a lucide icon for display.
const BADGE_ICON: Record<string, typeof Trophy> = {
  sunrise: Star,
  flame: Award,
  trophy: Trophy,
  users: Medal,
};

const RANK_STYLE = [
  "bg-yellow-100 text-yellow-800", // 1st
  "bg-gray-100 text-gray-700", // 2nd
  "bg-orange-100 text-orange-800", // 3rd
];

export default async function LeaderboardPage() {
  const { id: userId } = await requireUser();
  const t = await getTranslations("leaderboard");

  const [entries, myPoints] = await Promise.all([
    getMonthlyLeaderboard(),
    getUserTotalPoints(userId),
  ]);

  // My earned badges.
  const admin = createAdminClient();
  const { data: myBadgeRows } = await admin
    .from("user_badges")
    .select("badge_id, earned_at")
    .eq("user_id", userId);
  const badgeIds = (myBadgeRows ?? []).map((b) => b.badge_id);
  let myBadges: { id: string; name: string; name_ar: string | null; icon: string | null }[] =
    [];
  if (badgeIds.length) {
    const { data } = await admin
      .from("badges")
      .select("id, name, name_ar, icon")
      .in("id", badgeIds);
    myBadges = data ?? [];
  }

  const rules = [
    { label: t("ruleTaskEarly"), pts: POINTS.TASK_EARLY },
    { label: t("ruleTaskOnTime"), pts: POINTS.TASK_ON_TIME },
    { label: t("rulePeerHigh"), pts: POINTS.PEER_REVIEW_HIGH },
    { label: t("ruleStandup"), pts: POINTS.STANDUP_COMPLETED },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* My points + badges + rules */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">{t("myPoints")}</p>
          <p className="mt-1 flex items-center gap-2 text-4xl font-bold" dir="ltr">
            <Star className="size-7 text-yellow-500" />
            {myPoints}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <p className="mb-2 text-sm text-muted-foreground">{t("myBadges")}</p>
          {myBadges.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noBadges")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myBadges.map((b) => {
                const Icon = BADGE_ICON[b.icon ?? ""] ?? Award;
                return (
                  <span
                    key={b.id}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                  >
                    <Icon className="size-3.5" />
                    {b.name_ar || b.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <p className="mb-2 text-sm text-muted-foreground">
            {t("pointsRules")}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {rules.map((r, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>{r.label}</span>
                <span className="font-semibold text-green-600" dir="ltr">
                  +{r.pts}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Ranking */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-5">
          <h2 className="text-base font-semibold">{t("title")}</h2>
        </div>
        {entries.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y">
            {entries.map((e, i) => (
              <li
                key={e.userId}
                className={cn(
                  "flex items-center justify-between gap-3 p-4",
                  e.userId === userId && "bg-primary/5",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-sm font-bold",
                      i < 3 ? RANK_STYLE[i] : "bg-muted text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="font-medium">
                    {e.name}
                    {e.userId === userId ? (
                      <Badge variant="secondary" className="ms-2">
                        {t("you")}
                      </Badge>
                    ) : null}
                  </span>
                </div>
                <span className="flex items-center gap-1 font-bold" dir="ltr">
                  <Star className="size-4 text-yellow-500" />
                  {e.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
