export interface AppNotification {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  seen: boolean;
  createdAt: string;
}

export function unreadCount(list: AppNotification[]): number {
  return list.filter((n) => !n.seen).length;
}

/** Unseen notifications the app has not announced yet, oldest first. */
export function freshUnseen(known: ReadonlySet<string>, list: AppNotification[]): AppNotification[] {
  return list
    .filter((n) => !n.seen && !known.has(n.notificationId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
