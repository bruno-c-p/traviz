import { SignInButton } from "@clerk/nextjs";
import { BrandMark } from "@/components/BrandMark";
import { homePath } from "@/paths";

export function AuthPanel() {
  return (
    <div
      data-auth-panel
      className="flex min-h-dvh items-center justify-center bg-canvas-soft px-4 py-8"
    >
      <div className="w-full max-w-sm rounded-3xl bg-canvas p-7 shadow-card">
        <div className="mb-7 flex flex-col items-start gap-3">
          <BrandMark className="text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-ink">Traviz</h1>
          <p className="text-[15px] leading-relaxed text-body">
            Mark the countries you've visited, want to visit, or don't care about — synced to your
            account.
          </p>
        </div>

        <SignInButton mode="modal" forceRedirectUrl={homePath()}>
          <button
            type="button"
            className="min-h-12 w-full rounded-full bg-primary px-5 text-[15px] font-semibold text-on-primary pressable hover:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          >
            Sign in
          </button>
        </SignInButton>
      </div>
    </div>
  );
}
