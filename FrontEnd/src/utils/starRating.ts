/** Rounds a rating (0-5) to the nearest whole star and returns filled/empty counts. */
export function getStarSegments(rating: number) {
  const safeRating = Math.min(5, Math.max(0, rating));
  const filled = Math.round(safeRating);
  return { filled, empty: 5 - filled, safeRating };
}
