import { BrandMark } from "@/shared/brand-mark";

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-auth-panel
      className="flex min-h-dvh items-center justify-center bg-canvas-soft px-4 py-8"
    >
      <div className="w-full max-w-sm rounded-3xl bg-canvas p-7 shadow-card">
        <BrandMark className="mb-3 text-primary" />
        {children}
      </div>
    </div>
  );
}
