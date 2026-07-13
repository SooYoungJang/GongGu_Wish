export function getRandomReelIndex(
  length: number,
  currentIndex: number,
  random = Math.random,
) {
  if (length <= 1) return 0;

  const safeCurrentIndex = Math.min(Math.max(currentIndex, 0), length - 1);
  const safeRandom = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
  const candidate = Math.floor(safeRandom * (length - 1));

  return candidate >= safeCurrentIndex ? candidate + 1 : candidate;
}
