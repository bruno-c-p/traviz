import { SignInButton } from "@clerk/nextjs";
import { BrandMark } from "@/components/BrandMark";

export function AuthPanel() {
  return (
    <div
      data-auth-panel
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-canvas-soft/40 px-4 py-8"
    >
      <div className="w-full max-w-sm rounded-3xl bg-canvas/95 p-7 shadow-card backdrop-blur-md">
        <div className="mb-7 flex flex-col items-start gap-3">
          <BrandMark className="text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-ink">Traviz</h1>
          <p className="text-[15px] leading-relaxed text-body">
            Mark the countries you've visited, want to visit, or don't care about — synced to your
            account.
          </p>
        </div>

        <SignInButton mode="modal">
          <button
            type="button"
            className="min-h-12 w-full rounded-full bg-primary px-5 text-[15px] font-semibold text-on-primary transition-colors hover:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          >
            Sign in
          </button>
        </SignInButton>
      </div>
    </div>
  );
}
