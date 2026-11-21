/**
 * Notification par tap: uske `data.type` se tay karta hai ki app kaun si screen kholegi.
 * Server har push aur notification ke saath yahi data bhejta hai.
 */
export type PushData = Record<string, string | undefined> | undefined | null;

export function pushHref(d: PushData): string | null {
  const t = d?.type;
  if (!t) return null;
  switch (t) {
    case 'session': {
      if (!d?.sessionId) return null;
      return d.sessionType === 'CHAT' ? `/session/${d.sessionId}` : `/call/${d.sessionId}`;
    }
    case 'ticket':
      return d?.ticketId ? `/support/${d.ticketId}` : '/support';
    case 'scheduled_call':
      return '/bookings';
    case 'wallet':
      return '/wallet';
    case 'checkin':
      return '/checkin';
    case 'voice_reply':
    case 'voice_chosen':
      return '/voice';
    case 'policy':
      return '/legal';
    default:
      return '/notifications';
  }
}
