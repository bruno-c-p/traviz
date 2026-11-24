import { AuthCard, EmailLinkVerification } from "@/features/auth";

export default function SignInVerifyPage() {
  return (
    <AuthCard>
      <EmailLinkVerification />
    </AuthCard>
  );
}
