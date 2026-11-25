import type { APIRoute } from "astro";
import { handleMarkChange } from "@/features/marks/server";

export const POST: APIRoute = ({ request, locals }) => handleMarkChange(request, locals.userId);
