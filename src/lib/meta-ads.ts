import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/token-crypto";

// Meta (Facebook) Ads account insights for an organization's connected ad
// account. Pulled live (cached for an hour) into the analytics page so KPI
// numbers come from the platform instead of manual entry.

const GRAPH_URL = "https://graph.facebook.com/v20.0";

export interface AdsInsights {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  currency: string | null;
}

export async function orgMetaAdsConnected(orgId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_integrations")
    .select("meta_ad_account_id, meta_ads_token_enc")
    .eq("org_id", orgId)
    .maybeSingle();
  return Boolean(data?.meta_ad_account_id && data.meta_ads_token_enc);
}

// Last-30-days account insights, or null when not connected / API failure.
export async function fetchOrgAdsInsights(
  orgId: string,
): Promise<AdsInsights | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_integrations")
    .select("meta_ad_account_id, meta_ads_token_enc")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data?.meta_ad_account_id || !data.meta_ads_token_enc) return null;

  let token: string;
  try {
    token = decryptToken(data.meta_ads_token_enc);
  } catch {
    return null;
  }

  const accountId = data.meta_ad_account_id.replace(/^act_/, "");
  const url =
    `${GRAPH_URL}/act_${accountId}/insights` +
    `?fields=spend,impressions,clicks,ctr,cpc,account_currency` +
    `&date_preset=last_30d&access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error("[meta-ads] insights failed", res.status, await res.text());
      return null;
    }
    const body = (await res.json()) as {
      data?: Array<Record<string, string>>;
    };
    const row = body.data?.[0];
    if (!row) {
      return {
        spend: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        currency: null,
      };
    }
    return {
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      ctr: Number(row.ctr ?? 0),
      cpc: Number(row.cpc ?? 0),
      currency: row.account_currency ?? null,
    };
  } catch (err) {
    console.error("[meta-ads] insights failed", err);
    return null;
  }
}
