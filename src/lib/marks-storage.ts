export const MARKS_STORAGE_KEY = "traviz-marks";

export function forgetStoredMarks() {
  localStorage.removeItem(MARKS_STORAGE_KEY);
}
