export const MARKS_STORAGE_KEY = "traviz-marks";

export function forgetStoredMarks() {
  try {
    localStorage.removeItem(MARKS_STORAGE_KEY);
  } catch {}
}
