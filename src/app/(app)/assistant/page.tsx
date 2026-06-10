import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai";
import { AssistantChat } from "./chat";

// "Ask the system": a chat assistant answering questions about the caller's
// own (role-scoped) company data.
export default async function AssistantPage() {
  await requireUser();
  const t = await getTranslations("assistant");

  if (!aiConfigured()) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("notConfigured")}</p>
      </div>
    );
  }

  const suggestions = [
    t("suggestion1"),
    t("suggestion2"),
    t("suggestion3"),
    t("suggestion4"),
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <AssistantChat suggestions={suggestions} />
    </div>
  );
}
