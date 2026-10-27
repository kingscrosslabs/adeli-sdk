/** Node timers clamp values above this signed 32-bit millisecond limit to 1ms. */
export const MAX_TIMER_DURATION_MS = 2_147_483_647;

export function isRepresentableTimerDuration(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= MAX_TIMER_DURATION_MS;
}
