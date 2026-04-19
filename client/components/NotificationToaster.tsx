import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

const NOTIFICATION_SOUND_PATH = "/notification-chime.mp3";

export default function NotificationToaster() {
  const { user } = useSession();
  const scope = getAccountScope(user);
  const seenIds = useRef<Set<number>>(new Set());
  const initialized = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const notificationsQuery = useQuery({
    queryKey: accountQueryKeys.notifications(scope.role, scope.userId),
    queryFn: api.getNotifications,
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    seenIds.current = new Set();
    initialized.current = false;
  }, [user?.id]);

  useEffect(() => {
    const notifications = notificationsQuery.data?.notifications ?? [];
    if (!notifications.length) return;

    if (!initialized.current) {
      seenIds.current = new Set(notifications.map((item) => item.id));
      initialized.current = true;
      return;
    }

    notifications
      .filter((item) => !item.isRead && !seenIds.current.has(item.id))
      .forEach((item) => {
        seenIds.current.add(item.id);
        toast.custom(
          () => (
            <div
              role="alert"
              className="rounded-lg border-l-4 border-blue-500 bg-blue-100 p-3 text-blue-900 shadow-lg dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100"
            >
              <p className="text-xs font-semibold">{item.title}</p>
              <p className="mt-1 text-xs opacity-80">{item.message}</p>
            </div>
          ),
          { duration: 5000 },
        );

        if (!audioRef.current) {
          audioRef.current = new Audio(NOTIFICATION_SOUND_PATH);
          audioRef.current.preload = "none";
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});

        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification(item.title, { body: item.message });
        }
      });
  }, [notificationsQuery.data?.notifications]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return null;
}
