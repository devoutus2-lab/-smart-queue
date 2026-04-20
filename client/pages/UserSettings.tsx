import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, KeyRound, MoonStar, Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import UserWorkspaceFrame from "@/components/user/UserWorkspaceFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/context/SessionContext";
import { usePreferences } from "@/context/PreferencesContext";
import { api } from "@/lib/api";

export default function UserSettings() {
  const navigate = useNavigate();
  const { logout } = useSession();
  const {
    theme,
    setTheme,
    compactMode,
    toggleCompactMode,
    emailSummaries,
    toggleEmailSummaries,
    desktopNotifications,
    toggleDesktopNotifications,
    aiAssistant,
    toggleAiAssistant,
    travelTips,
    toggleTravelTips,
  } = usePreferences();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const settingItems = [
    { label: "Compact layout", value: compactMode, handler: toggleCompactMode },
    { label: "Email summaries", value: emailSummaries, handler: toggleEmailSummaries },
    { label: "Desktop notifications", value: desktopNotifications, handler: toggleDesktopNotifications },
    { label: "Quick help bubble", value: aiAssistant, handler: toggleAiAssistant },
    { label: "Travel tips", value: travelTips, handler: toggleTravelTips },
  ];

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Fill in all password fields before saving.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Your new password confirmation does not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Use at least 6 characters for your new password.");
      return;
    }

    setPasswordSubmitting(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "We couldn't update your password yet.");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function handleDeleteAccount(event: React.FormEvent) {
    event.preventDefault();
    setDeleteError("");
    if (!deletePassword) {
      setDeleteError("Enter your password before deleting this account.");
      return;
    }
    if (deleteConfirmation.trim().toUpperCase() !== "DELETE") {
      setDeleteError("Type DELETE exactly before continuing.");
      return;
    }
    setDeleteSubmitting(true);
    try {
      await api.deleteAccount({
        password: deletePassword,
        confirmation: deleteConfirmation,
      });
      await logout();
      navigate("/login", { replace: true });
      toast.success("Your account was deleted.");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "We couldn't delete your account yet.");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <UserWorkspaceFrame
      title="Settings"
      subtitle="Adjust your everyday preferences, protect your password, and manage account safety in one place."
    >
      <section className="grid gap-7 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-7">
          <div className="section-shell panel-roomy">
            <div className="flex items-center gap-3">
              <MoonStar className="h-5 w-5 text-amber-500" />
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Appearance</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {(["light", "dark", "system"] as const).map((mode) => (
                <button
                  key={mode}
                  className={`rounded-2xl border px-4 py-4 text-left text-sm font-semibold ${theme === mode ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-slate-900" : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"}`}
                  onClick={() => setTheme(mode)}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)} mode
                </button>
              ))}
            </div>
          </div>

          <div className="section-shell panel-roomy">
            <div className="flex items-center gap-3">
              <Settings2 className="h-5 w-5 text-blue-600" />
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Preferences</h2>
            </div>
            <div className="mt-5 space-y-4">
              {settingItems.map((item) => (
                <div key={item.label} className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/80">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Adjust how your account feels day to day.</div>
                  </div>
                  <Switch checked={item.value} onCheckedChange={item.handler} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-7">
          <div className="section-shell panel-roomy">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-emerald-600" />
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Password security</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Keep your account protected by updating your password when needed. Use at least 6 characters and avoid reusing an old password.
            </p>
            <form className="mt-5 space-y-4" onSubmit={handlePasswordSubmit}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Current password</label>
                <PasswordInput value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">New password</label>
                <PasswordInput value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Confirm new password</label>
                <PasswordInput value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </div>
              {passwordError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{passwordError}</div> : null}
              <Button className="site-primary-button" disabled={passwordSubmitting} type="submit">
                {passwordSubmitting ? "Updating password..." : "Update password"}
              </Button>
            </form>
          </div>

          <div className="section-shell panel-roomy border-red-200/80 dark:border-red-900/60">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="section-heading text-slate-900 dark:text-slate-100">Danger zone</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Deleting your account removes your queues, appointments, saved places, notifications, and chat history tied to this login. This cannot be undone.
            </p>
            <form className="mt-5 space-y-4" onSubmit={handleDeleteAccount}>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  Confirm carefully
                </div>
                <div className="mt-1">Type <span className="font-semibold">DELETE</span> and enter your password to continue.</div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Password</label>
                <PasswordInput value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Confirmation word</label>
                <Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="DELETE" />
              </div>
              {deleteError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div> : null}
              <Button className="min-h-[48px] w-full rounded-2xl bg-red-600 text-white hover:bg-red-700" disabled={deleteSubmitting || !deletePassword || deleteConfirmation.trim().toUpperCase() !== "DELETE"} type="submit">
                {deleteSubmitting ? "Deleting account..." : "Delete account permanently"}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </UserWorkspaceFrame>
  );
}
