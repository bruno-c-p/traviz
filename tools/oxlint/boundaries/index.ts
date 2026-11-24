import { eslintCompatPlugin } from "@oxlint/plugins";

import { apiRouteRule } from "./api-route.ts";
import { featureEntryRule } from "./feature-entry.ts";
import { noCommentsRule } from "./no-comments.ts";
import { noEmptyImportRule } from "./no-empty-import.ts";
import { serverOnlyModuleRule } from "./server-only-module.ts";

export default eslintCompatPlugin({
  meta: { name: "boundaries" },
  rules: {
    "api-route": apiRouteRule,
    "feature-entry": featureEntryRule,
    "no-comments": noCommentsRule,
    "no-empty-import": noEmptyImportRule,
    "server-only-module": serverOnlyModuleRule,
  },
});
