"use server";

import { createReadMarks, databaseMarksReader } from "@/features/marks/services/marks";
import { getUserId } from "@/features/auth/server";

export const readMarks = createReadMarks({ ...databaseMarksReader, getUserId });
