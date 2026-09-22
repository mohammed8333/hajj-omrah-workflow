import { AppNotification, GroupRequestSummary, UserRole } from "@/types";

const NOTIFICATIONS_STORAGE_KEY = "app_live_notifications_v1";

export const notificationsService = {
  getAll(): AppNotification[] {
    if (typeof window === "undefined") return [];
    try {
      const data = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as AppNotification[];
    } catch {
      return [];
    }
  },

  getForUser(userId?: string, role?: UserRole): AppNotification[] {
    const all = this.getAll();
    return all.filter((n) => {
      // If targeted to specific user
      if (n.targetUserId && userId) {
        return n.targetUserId === userId;
      }
      // If targeted to a role
      if (n.targetRole && n.targetRole !== "All") {
        if (!role) return false;
        if (role === "Admin") return true; // Admin sees all
        return n.targetRole === role;
      }
      return true;
    });
  },

  getUnreadCount(userId?: string, role?: UserRole): number {
    const list = this.getForUser(userId, role);
    return list.filter((n) => !n.isRead).length;
  },

  add(notif: Omit<AppNotification, "id" | "createdAt" | "isRead">): AppNotification {
    const all = this.getAll();
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    const updated = [newNotif, ...all].slice(0, 50); // Keep last 50
    if (typeof window !== "undefined") {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("app_notifications_updated"));
    }
    return newNotif;
  },

  markAsRead(id: string): void {
    const all = this.getAll();
    const updated = all.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    if (typeof window !== "undefined") {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("app_notifications_updated"));
    }
  },

  markAllAsRead(): void {
    const all = this.getAll();
    const updated = all.map((n) => ({ ...n, isRead: true }));
    if (typeof window !== "undefined") {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("app_notifications_updated"));
    }
  },

  /**
   * Automatically detect urgent upcoming flights (within 48 hours) that need Nusuk or are not completed,
   * and emit an alert notification if not already notified today.
   */
  checkAndGenerateUrgentFlightAlerts(requests: GroupRequestSummary[]): void {
    if (typeof window === "undefined" || !requests || requests.length === 0) return;

    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const existing = this.getAll();

    requests.forEach((r) => {
      if (r.status === "Completed" || r.status === "Archived" || r.status === "Cancelled") {
        return;
      }
      const depDateStr = r.departureDate || r.travelDate;
      if (!depDateStr) return;

      const depDate = new Date(depDateStr);
      if (isNaN(depDate.getTime())) return;

      // Check if departure is between now and next 48 hours
      if (depDate >= now && depDate <= in48Hours) {
        const notifTag = `urgent-flight-${r.id}-${depDateStr}`;
        const alreadyNotified = existing.some((n) => n.id.includes(notifTag));

        if (!alreadyNotified) {
          const hoursLeft = Math.max(1, Math.round((depDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
          this.add({
            title: `تنبيه رحلة وشيكة (${hoursLeft} ساعة) 🚨`,
            message: `فوج "${r.groupName}" موعد سفره خلال ${hoursLeft} ساعة${
              !r.nusukGroupNumber ? " وما زال بدون رقم نسك!" : "!"
            }`,
            type: "urgent",
            requestId: r.id,
            requestNumber: r.requestNumber,
            targetRole: "All",
            linkUrl: `/requests/${r.id}`,
          });
        }
      }
    });
  },
};
