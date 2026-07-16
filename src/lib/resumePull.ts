export const RESUME_PULL_INTERVAL_MS = 30_000;

export function shouldPullOnResume(
  previousPullStartedAt: number | null,
  now: number,
): boolean {
  if (!Number.isFinite(now)) return false;
  if (previousPullStartedAt === null) return true;
  if (!Number.isFinite(previousPullStartedAt)) return false;
  return now - previousPullStartedAt >= RESUME_PULL_INTERVAL_MS;
}
