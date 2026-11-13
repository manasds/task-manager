import { Activity } from '../types/activity';
import { STARTER_ACTIVITY_ID } from './localDocument';

/** Signed-out boards get a gentle sign-in prompt once they hold this many tasks. */
export const GUEST_NUDGE_AT = 3;

/** Signed-out boards cannot hold more than this many tasks; adding another needs sign-in. */
export const GUEST_TASK_LIMIT = 6;

/** Only the id matters for counting. */
type CountedTask = Pick<Activity, 'id'>;

/** Tasks the guest made themselves. The starter task doesn't count. */
export function countGuestTasks(activities: CountedTask[]): number {
  return activities.filter((a) => a.id !== STARTER_ACTIVITY_ID).length;
}

export function guestAtLimit(activities: CountedTask[]): boolean {
  return countGuestTasks(activities) >= GUEST_TASK_LIMIT;
}

/** Show the dismissible prompt between the nudge point and the limit (the wall takes over there). */
export function shouldNudgeGuest(activities: CountedTask[], dismissed: boolean): boolean {
  if (dismissed) return false;
  const count = countGuestTasks(activities);

  return count >= GUEST_NUDGE_AT && count < GUEST_TASK_LIMIT;
}
