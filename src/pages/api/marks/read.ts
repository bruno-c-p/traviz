import type { APIRoute } from "astro";
import { handleMarksRead } from "@/features/marks/server";

export const POST: APIRoute = ({ request, locals }) => handleMarksRead(request, locals.userId);
