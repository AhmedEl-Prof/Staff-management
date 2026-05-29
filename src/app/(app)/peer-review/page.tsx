import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import {
  currentReviewPeriod,
  ratingsAverage,
  PEER_CRITERIA,
} from "@/lib/peer-review";
import {
  ReviewForm,
  type Colleague,
  type ExistingReview,
} from "./review-form";
import type { PeerReviewRow } from "@/types/database";

export default async function PeerReviewPage() {
  const { id: userId } = await requireUser();
  const t = await getTranslations("peerReview");
  const { start } = currentReviewPeriod();

  const admin = createAdminClient();
  const supabase = await createClient();

  // Colleagues = all other active employees.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, arabic_name, full_name")
    .eq("is_active", true)
    .neq("id", userId)
    .order("arabic_name");
  const colleagues: Colleague[] = (profiles ?? []).map((p) => ({
    id: p.id,
    label: p.arabic_name || p.full_name || p.id,
  }));
  const nameById = new Map(colleagues.map((c) => [c.id, c.label]));

  // Reviews the caller gave this month (RLS: reviewer_id = self is visible).
  const { data: givenRows } = await supabase
    .from("peer_reviews")
    .select("*")
    .eq("reviewer_id", userId)
    .eq("period_start", start);
  const given = (givenRows ?? []) as PeerReviewRow[];

  const existingByReviewee: Record<string, ExistingReview> = {};
  for (const r of given) {
    existingByReviewee[r.reviewee_id] = {
      reviewee_id: r.reviewee_id,
      ratings: (r.ratings as Record<string, number>) ?? {},
      comments: r.comments,
      is_anonymous: r.is_anonymous,
    };
  }

  // Reviews the caller received this month (RLS allows reviewee to read its
  // Reviews the caller received this month. Read via the admin client and
  // aggregated to a summary only — reviewer identity never leaves the server,
  // so anonymity holds at the data layer (not just the UI). We select only the
  // ratings column.
  const { data: receivedRows } = await admin
    .from("peer_reviews")
    .select("ratings")
    .eq("reviewee_id", userId)
    .eq("period_start", start);
  const received = (receivedRows ?? []) as Array<
    Pick<PeerReviewRow, "ratings">
  >;

  const receivedAvg =
    received.length === 0
      ? 0
      : Math.round(
          (received.reduce((s, r) => s + ratingsAverage(r.ratings), 0) /
            received.length) *
            10,
        ) / 10;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Submit / edit a review */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("newReview")}</h2>
        <ReviewForm
          colleagues={colleagues}
          existingByReviewee={existingByReviewee}
        />
      </section>

      {/* Reviews I gave */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("myGiven")}</h2>
        {given.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noneGiven")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {given.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <span className="font-medium">
                  {nameById.get(r.reviewee_id) ?? r.reviewee_id}
                </span>
                <div className="flex items-center gap-2">
                  {r.is_anonymous ? (
                    <Badge variant="muted">{t("anonymousReviewer")}</Badge>
                  ) : null}
                  <Badge variant="secondary">
                    {t("average")}: {ratingsAverage(r.ratings)}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reviews I received (summary — reviewers not exposed) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("receivedSummary")}</h2>
        {received.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noneReceived")}</p>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg border bg-card p-5">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold" dir="ltr">
                {receivedAvg}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("avgReceived")} ·{" "}
                {t("reviewsCount", { count: received.length })}
              </span>
            </div>
            {/* Per-criterion averages */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PEER_CRITERIA.map((c) => {
                const vals = received
                  .map((r) => Number((r.ratings as Record<string, unknown>)[c]))
                  .filter((n) => Number.isFinite(n));
                const avg =
                  vals.length === 0
                    ? 0
                    : Math.round(
                        (vals.reduce((s, n) => s + n, 0) / vals.length) * 10,
                      ) / 10;
                return (
                  <div
                    key={c}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{t(c)}</span>
                    <span className="font-semibold" dir="ltr">
                      {avg}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
