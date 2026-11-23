import { THEME_SCRIPT } from "@/features/theme/theme";

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
