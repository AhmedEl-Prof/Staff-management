import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// Home / dashboard landing. The middleware guarantees an authenticated user
// reaches this page; here we just greet them. Real dashboard widgets land in
// Phase 3+ of the roadmap.
export default async function HomePage() {
  const t = await getTranslations("dashboard");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">
        {t("welcome")}
        {user?.email ? ` — ${user.email}` : ""}
      </p>
    </main>
  );
}
