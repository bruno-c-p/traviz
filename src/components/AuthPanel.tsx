import { SignInButton } from "@clerk/nextjs";
import { BrandMark } from "@/components/BrandMark";

export function AuthPanel() {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-canvas-soft px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <BrandMark className="text-primary" />
          <h1 className="text-2xl font-black text-ink">Traviz</h1>
          <p className="text-center text-sm text-body">
            Mark the countries you've visited, want to visit, or don't care about — synced to your
            account.
          </p>
        </div>

        <div className="rounded-xl bg-canvas p-6 shadow-sm">
          <SignInButton mode="modal">
            <button
              type="button"
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-active"
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </div>
    </div>
  );
}
