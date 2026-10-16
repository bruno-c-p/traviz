import { eslintCompatPlugin } from "@oxlint/plugins";

import { featureEntryRule } from "./feature-entry.ts";
import { noCommentsRule } from "./no-comments.ts";
import { serverOnlyModuleRule } from "./server-only-module.ts";
import { useServerPlacementRule } from "./use-server-placement.ts";

export default eslintCompatPlugin({
  meta: { name: "boundaries" },
  rules: {
    "feature-entry": featureEntryRule,
    "no-comments": noCommentsRule,
    "server-only-module": serverOnlyModuleRule,
    "use-server-placement": useServerPlacementRule,
  },
});
