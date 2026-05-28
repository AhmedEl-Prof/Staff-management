import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const { profile, email } = await requireUser();
  const t = await getTranslations("profile");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground" dir="ltr">
          {email}
        </p>
      </div>
      <ProfileForm profile={profile} />
    </div>
  );
}
