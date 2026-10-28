// Shared categorical colors. Every chart also retains text labels and values.
export const SERIES_COLORS = [
  "#786591", "#55735f", "#b68531", "#527c92",
  "#a65b42", "#9e6d89", "#6f7660", "#44484d",
];

export function seriesColorForKey(value) {
  let hash = 0;
  for (const char of String(value || "viewer")) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const cursorColors = [SERIES_COLORS[0], SERIES_COLORS[1], SERIES_COLORS[3], SERIES_COLORS[6]];
  return cursorColors[Math.abs(hash) % cursorColors.length];
}

export const WORKSPACE_COLORS = {
  project: "#e9e0f1", worked: "#e2ecdc", planned: "#eeebdf", date: "#f6e5d9", neutral: "#f1f1ef",
};
export const WORKSPACE_THEME = Object.fromEntries(Object.entries(WORKSPACE_COLORS).map(([key, value]) => [`--workspace-${key}`, value]));
export const COVER_COLORS = ["#e9ad79", "#e0dc7b", "#b8c9ae", "#c3bbdf", "#e5b8ce", "#b9ced9"];
