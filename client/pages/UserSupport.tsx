import UserWorkspaceFrame from "@/components/user/UserWorkspaceFrame";
import { SupportInboxPanel } from "@/components/SupportInboxPanel";

export default function UserSupport() {
  return (
    <UserWorkspaceFrame
      title="Technical support"
      subtitle="Contact Smart Queue support here when something is broken, not loading, or needs technical help."
    >
      <SupportInboxPanel
        autoCreate
        mode="requester"
        title="Smart Queue support"
        description="Use this dedicated support screen for technical issues, broken behavior, login/access problems, missing data, and other problems that need Smart Queue support."
      />
    </UserWorkspaceFrame>
  );
}
