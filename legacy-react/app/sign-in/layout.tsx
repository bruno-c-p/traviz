import { ClerkProvider } from "@clerk/nextjs";

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider prefetchUI={false}>{children}</ClerkProvider>;
}
