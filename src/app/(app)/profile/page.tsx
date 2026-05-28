import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "./profile-form";
import { DriveSection } from "./drive-section";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string; drive_error?: string }>;
}) {
  const { profile, email, id } = await requireUser();
  const t = await getTranslations("profile");
  const sp = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground" dir="ltr">
          {email}
        </p>
      </div>
      <ProfileForm profile={profile} />
      <DriveSection userId={id} status={sp.drive} errorCode={sp.drive_error} />
    </div>
  );
}
