/**
 * Pure decision helper for alert-window.js. Framework-free (no DOM, no
 * globals) so the "is this alert's date window active right now" rule lives in
 * one unit-testable place.
 *
 * An alert is visible unless its window excludes `now`:
 *   - hidden when start is set and start > now (strictly after)
 *   - hidden when end is set and end < now (strictly before)
 *
 * Both bounds are optional and independent — most live alerts have no end
 * ("show indefinitely"). Comparison is on full UTC timestamps (Bruce sends
 * midnight UTC), never calendar days: an alert starting today at 00:00:00Z is
 * visible all of that day.
 *
 * Fails OPEN: a missing, empty, or unparsable bound is treated as no
 * constraint, so a data bug shows the alert rather than hiding it.
 *
 * @param {string | null} startRaw  ISO 8601 timestamp, or empty/null
 * @param {string | null} endRaw    ISO 8601 timestamp, or empty/null
 * @param {Date} now
 * @returns {boolean} visible
 */
export function decideAlertVisible(startRaw, endRaw, now) {
  const start = parseBound(startRaw);
  const end = parseBound(endRaw);
  if (start !== null && start > now.getTime()) return false;
  if (end !== null && end < now.getTime()) return false;
  return true;
}

/** Epoch ms for a usable bound, or null for empty/missing/unparsable. */
function parseBound(raw) {
  if (!raw || !raw.trim()) return null;
  const time = new Date(raw).getTime();
  return isNaN(time) ? null : time;
}
