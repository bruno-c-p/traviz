import "client-only";
import { COUNTRY_STATES, type Marks } from "@/features/marks/colors";
import type { MarksCache } from "@/features/marks/marks-owner";
import type { CachedMarks } from "@/features/marks/marks-sync";

const MARKS_CACHE_KEY = "traviz-marks-v2";
const RETIRED_MARKS_KEY = "traviz-marks";
const OWNER_FIELD = "ownerId";

function parseCachedMarks(text: string): CachedMarks | null {
  const fields = new URLSearchParams(text);
  const ownerId = fields.get(OWNER_FIELD);

  if (ownerId === null) return null;

  fields.delete(OWNER_FIELD);

  const marks: Marks = {};

  for (const [code, mark] of fields) {
    const state = COUNTRY_STATES.find((countryState) => countryState === mark);

    if (state === undefined) return null;

    marks[code] = state;
  }

  return { ownerId, marks };
}

function serializeCachedMarks({ ownerId, marks }: CachedMarks): string {
  return new URLSearchParams({ ...marks, [OWNER_FIELD]: ownerId }).toString();
}

export function createMarksCache(getStorage: () => Storage): MarksCache {
  return {
    read: () => {
      const text = getStorage().getItem(MARKS_CACHE_KEY);

      return text === null ? null : parseCachedMarks(text);
    },
    write: (cached) => {
      getStorage().setItem(MARKS_CACHE_KEY, serializeCachedMarks(cached));
      getStorage().removeItem(RETIRED_MARKS_KEY);
    },
    clear: () => {
      getStorage().removeItem(MARKS_CACHE_KEY);
      getStorage().removeItem(RETIRED_MARKS_KEY);
    },
  };
}
