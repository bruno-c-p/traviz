import { AuthCard } from "@/features/auth/auth-card";
import { EmailLinkForm } from "@/features/auth/email-link-form";

export function AuthPanel() {
  return (
    <AuthCard>
      <div className="mb-7 flex flex-col items-start gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Traviz</h1>
        <p className="text-[15px] leading-relaxed text-body">
          Mark the countries you've visited, want to visit, or don't care about — synced to your
          account.
        </p>
      </div>
      <EmailLinkForm />
    </AuthCard>
  );
}
