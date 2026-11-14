/** «4:15», «1:02:03» — секунды в формат для таймкодов. */
export function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Номер главы, которая идёт сейчас; -1 — до первой главы. */
export function activeChapterIndex(
  chapters: readonly { time: number }[],
  currentTime: number,
): number {
  let active = -1;
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    if (chapter && chapter.time <= currentTime) active = i;
    else break;
  }
  return active;
}
