import { defineMiddleware } from "astro:middleware";
import { authenticateRequest } from "@/features/auth/server";
import { gateRequest } from "@/shared/route-gate";
import { gzipResponse } from "@/shared/server/gzip-response";

function withPrivateCache(response: Response): Response {
  if (!response.headers.has("cache-control")) {
    response.headers.set("cache-control", "private, no-store");
  }

  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();

  const response = await gateRequest(context.request, authenticateRequest, async (userId) => {
    context.locals.userId = userId;

    return withPrivateCache(await next());
  });

  return import.meta.env.TRAVIZ_NODE_SERVER === true
    ? gzipResponse(context.request, response)
    : response;
});
