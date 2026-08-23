import { DataPanel } from "../../components/DataPanel";

// instant = false: kept on purpose — AppShell (root layout) client auth gate
// decides what renders (loading/sign-in vs. page content), dropping this
// segment from SSR.
export const instant = false;

export default function DataPage() {
  return <DataPanel />;
}
