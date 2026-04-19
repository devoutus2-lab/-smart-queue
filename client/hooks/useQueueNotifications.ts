import { useEffect, useRef } from "react";
import type { QueueRealtimeEvent } from "@shared/api";

interface NotificationData {
  entryId: number;
  timeRemaining: number;
  businessName: string;
  queuePosition: string;
  status: string;
  desktopEnabled: boolean;
  realtimeEvent?: QueueRealtimeEvent | null;
}

export function useQueueNotifications(data: NotificationData | null) {
  const permissionRequested = useRef(false);
  const reminderIntervalRef = useRef<number | null>(null);
  const firstReminderTimeoutRef = useRef<number | null>(null);
  const reminderCycleKeyRef = useRef<string | null>(null);
  const urgentAlertSent = useRef(false);
  const finalAlertSent = useRef(false);
  const latestRealtimeEventKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!data || typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (!data.desktopEnabled) {
      return;
    }

    if (!permissionRequested.current && Notification.permission === "default") {
      permissionRequested.current = true;
      Notification.requestPermission().catch(() => {});
    }

    const cycleKey = `${data.entryId}:${data.status}`;
    if (reminderCycleKeyRef.current !== cycleKey) {
      reminderCycleKeyRef.current = cycleKey;
      urgentAlertSent.current = false;
      finalAlertSent.current = false;
      if (firstReminderTimeoutRef.current) window.clearTimeout(firstReminderTimeoutRef.current);
      if (reminderIntervalRef.current) window.clearInterval(reminderIntervalRef.current);
      firstReminderTimeoutRef.current = null;
      reminderIntervalRef.current = null;
    }

    if (data.status === "waiting" && data.timeRemaining > 0 && !reminderIntervalRef.current && !firstReminderTimeoutRef.current) {
      const reminder = () => {
        showNotification("Queue reminder", `About ${formatRemaining(data.timeRemaining)} left at ${data.businessName}. Your current place is ${data.queuePosition}.`);
        playSound();
      };
      reminder();
      firstReminderTimeoutRef.current = window.setTimeout(() => {
        reminder();
        reminderIntervalRef.current = window.setInterval(reminder, 90_000);
        firstReminderTimeoutRef.current = null;
      }, 90_000);
    }

    const minutesRemaining = Math.ceil(data.timeRemaining / 60);

    if (data.timeRemaining <= 300 && data.timeRemaining > 0 && !urgentAlertSent.current) {
      urgentAlertSent.current = true;
      showNotification("Queue update", `Only about ${minutesRemaining} minutes left at ${data.businessName}.`);
      playSound();
    }

    if (data.timeRemaining <= 0 && !finalAlertSent.current) {
      finalAlertSent.current = true;
      showNotification("It's your turn", `Please proceed now for ${data.businessName}.`);
      playSound();
    }

    if (data.realtimeEvent?.changedAt) {
      const realtimeKey = `${data.realtimeEvent.entryId ?? "queue"}:${data.realtimeEvent.action}:${data.realtimeEvent.changedAt}`;
      if (latestRealtimeEventKeyRef.current !== realtimeKey) {
        latestRealtimeEventKeyRef.current = realtimeKey;
        const action = data.realtimeEvent.action;
        if (action === "called") {
          showNotification("You're being called", data.realtimeEvent.message);
          playSound();
        } else if (action === "in_service") {
          showNotification("Service is starting", data.realtimeEvent.message);
          playSound();
        } else if (["delayed", "cancel", "no_show", "pause-expired", "joins-paused"].includes(action)) {
          showNotification("Queue update", data.realtimeEvent.message);
          playSound();
        }
      }
    }
    return () => {
      if (!data) return;
    };
  }, [data]);

  useEffect(() => {
    return () => {
      if (firstReminderTimeoutRef.current) window.clearTimeout(firstReminderTimeoutRef.current);
      if (reminderIntervalRef.current) window.clearInterval(reminderIntervalRef.current);
    };
  }, []);
}

function showNotification(title: string, body: string) {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function formatRemaining(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  }
  return `${minutes} min`;
}

function playSound() {
  const audio = new Audio("/soundreality-notification-11-294437.mp3");
  audio.play().catch(() => {});
}
