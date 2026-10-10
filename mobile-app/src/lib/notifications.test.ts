import { freshUnseen, unreadCount } from './notifications';
import type { AppNotification } from './notifications';

const n = (id: string, seen: boolean, createdAt: string): AppNotification => ({
  notificationId: id,
  type: 'TICKET_ISSUED',
  title: `title ${id}`,
  message: 'm',
  seen,
  createdAt,
});

describe('unreadCount', () => {
  it('counts unseen notifications', () => {
    expect(
      unreadCount([
        n('a', false, '2026-10-10T08:00:00Z'),
        n('b', true, '2026-10-10T08:01:00Z'),
        n('c', false, '2026-10-10T08:02:00Z'),
      ]),
    ).toBe(2);
    expect(unreadCount([])).toBe(0);
  });
});

describe('freshUnseen', () => {
  it('returns unseen items not yet known, oldest first', () => {
    const list = [
      n('new2', false, '2026-10-10T08:03:00Z'),
      n('known', false, '2026-10-10T08:01:00Z'),
      n('seen', true, '2026-10-10T08:02:00Z'),
      n('new1', false, '2026-10-10T08:02:30Z'),
    ];
    const fresh = freshUnseen(new Set(['known']), list);
    expect(fresh.map((x) => x.notificationId)).toEqual(['new1', 'new2']);
  });

  it('returns nothing when everything is known', () => {
    expect(freshUnseen(new Set(['a']), [n('a', false, '2026-10-10T08:00:00Z')])).toEqual([]);
  });
});
