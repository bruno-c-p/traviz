import { AuthCard } from "@/features/auth/components/auth-card";
import { EmailLinkVerification } from "@/features/auth/components/email-link-verification";

export default function SignInVerifyPage() {
  return (
    <AuthCard>
      <EmailLinkVerification />
    </AuthCard>
  );
}
