import NotificationCenter from "@/components/NotificationCenter";
import UserWorkspaceFrame from "@/components/user/UserWorkspaceFrame";

export default function UserNotifications() {
  return (
    <UserWorkspaceFrame
      title="Notifications"
      subtitle="Keep queue updates, messages, schedule changes, and system notices together in one calm feed."
    >
      <NotificationCenter
        scope="user"
        title="Your notification center"
        subtitle="Everything tied to your visits, chats, queue timing, and account updates lands here."
      />
    </UserWorkspaceFrame>
  );
}
