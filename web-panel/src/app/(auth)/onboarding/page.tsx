import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Si ya tiene empresa, redirigir al dashboard
  const empresaId =
    user.user_metadata?.empresa_id ||
    user.user_metadata?.raw_user_meta_data?.empresa_id;
  if (empresaId) redirect("/dashboard");

  return <OnboardingWizard userEmail={user.email ?? ""} />;
}
