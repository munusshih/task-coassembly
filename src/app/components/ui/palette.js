// Shared categorical colors. Every chart also retains text labels and values.
export const SERIES_COLORS = Array.from({length:8},(_,index)=>`var(--series-${index+1})`);

export function seriesColorForKey(value) {
  let hash = 0;
  for (const char of String(value || "viewer")) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const cursorColors = [SERIES_COLORS[0], SERIES_COLORS[1], SERIES_COLORS[3], SERIES_COLORS[6]];
  return cursorColors[Math.abs(hash) % cursorColors.length];
}

export const WORKSPACE_COLORS = Object.fromEntries(['project','worked','planned','date','neutral'].map(key=>[key,`var(--palette-${key})`]));
export const WORKSPACE_THEME = Object.fromEntries(Object.entries(WORKSPACE_COLORS).map(([key, value]) => [`--workspace-${key}`, value]));
export const COVER_COLORS = Array.from({length:6},(_,index)=>`var(--cover-${index+1})`);
