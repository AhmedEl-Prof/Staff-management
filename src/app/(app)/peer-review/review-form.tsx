"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PEER_CRITERIA } from "@/lib/peer-review";
import { submitPeerReview, type PeerReviewState } from "./actions";

const initial: PeerReviewState = { error: null, saved: false };

export interface Colleague {
  id: string;
  label: string;
}

export interface ExistingReview {
  reviewee_id: string;
  ratings: Record<string, number>;
  comments: string | null;
  is_anonymous: boolean;
}

export function ReviewForm({
  colleagues,
  existingByReviewee,
}: {
  colleagues: Colleague[];
  // Map of reviewee_id -> the caller's existing review this month (if any).
  existingByReviewee: Record<string, ExistingReview>;
}) {
  const t = useTranslations("peerReview");
  const [state, formAction, pending] = useActionState(
    submitPeerReview,
    initial,
  );
  const [selected, setSelected] = useState("");

  const existing = selected ? existingByReviewee[selected] : undefined;

  if (colleagues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("noColleagues")}</p>
    );
  }

  return (
    <form
      action={formAction}
      className="flex max-w-2xl flex-col gap-5 rounded-lg border bg-muted/40 p-5"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="reviewee_id">{t("selectColleague")}</Label>
        <Select
          id="reviewee_id"
          name="reviewee_id"
          required
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="" disabled>
            {t("selectColleague")}
          </option>
          {colleagues.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
              {existingByReviewee[c.id] ? " ✓" : ""}
            </option>
          ))}
        </Select>
        {existing ? (
          <p className="text-xs text-muted-foreground">
            {t("alreadyReviewed")}
          </p>
        ) : null}
      </div>

      {/* Reset the rating inputs when the selected colleague changes by keying
          the criteria block on the selected id. */}
      <div key={selected} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>{t("criteria")}</Label>
          <span className="text-xs text-muted-foreground">
            {t("ratingHint")}
          </span>
        </div>
        {PEER_CRITERIA.map((c) => (
          <div key={c} className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{t(c)}</span>
            <Select
              name={c}
              defaultValue={String(existing?.ratings?.[c] ?? 3)}
              className="w-24"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="comments">{t("comments")}</Label>
        <Textarea
          id="comments"
          name="comments"
          placeholder={t("commentsPlaceholder")}
          defaultValue={existing?.comments ?? ""}
          rows={3}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_anonymous"
          defaultChecked={existing?.is_anonymous ?? false}
          className="size-4 accent-primary"
        />
        {t("anonymous")}
      </label>

      {state.saved ? (
        <p className="text-sm text-green-600">{t("submitted")}</p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending || !selected}>
          {existing ? t("editReview") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
