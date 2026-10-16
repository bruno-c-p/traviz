import { join } from "node:path";
import { RuleTester } from "oxlint/plugins-dev";

import { repoRoot } from "./project-path.ts";

export const tester = new RuleTester({ cwd: join(repoRoot, "src") });

export function at(path: string, code: string) {
  return { code, filename: join(repoRoot, path) };
}
