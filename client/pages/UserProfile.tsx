import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProfileUpdateInput, UserProfile } from "@shared/api";
import { toast } from "sonner";
import UserWorkspaceFrame from "@/components/user/UserWorkspaceFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/context/SessionContext";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

const emptyProfile: ProfileUpdateInput = {
  name: "",
  email: "",
  phone: "",
  bio: "",
  avatarUrl: "",
  location: "",
};

function UserProfileContent({ profile, initials }: { profile?: UserProfile; initials: string }) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const scope = getAccountScope(user);
  const [profileForm, setProfileForm] = useState<ProfileUpdateInput>(emptyProfile);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      name: profile.name,
      email: profile.email,
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
      avatarUrl: profile.avatarUrl ?? "",
      location: profile.location ?? "",
    });
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload: ProfileUpdateInput) => api.updateProfile(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.profile(scope.userId) }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
      ]);
      setProfileError("");
      toast.success("Profile updated.");
    },
    onError: (error) => {
      setProfileError(error instanceof Error ? error.message : "We couldn't update your profile yet.");
    },
  });

  function handleSaveProfile() {
    setProfileError("");
    if (!profileForm.name.trim()) {
      setProfileError("Enter your full name before saving.");
      return;
    }
    if (!profileForm.email.trim()) {
      setProfileError("Enter an email address before saving.");
      return;
    }
    updateProfileMutation.mutate(profileForm);
  }

  return (
    <section className="grid gap-7 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="section-shell panel-roomy">
        <div className="flex flex-col items-center rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-slate-800 to-blue-800 p-8 text-white">
          {profileForm.avatarUrl ? (
            <img alt={profileForm.name} className="h-24 w-24 rounded-3xl object-cover" src={profileForm.avatarUrl} />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/15 text-3xl font-bold">{initials}</div>
          )}
          <div className="mt-4 text-2xl font-bold">{profileForm.name || "Your profile"}</div>
          <div className="text-sm text-blue-100">{profileForm.email || "Add your email"}</div>
        </div>
      </div>
      <div className="section-shell panel-roomy">
        <h2 className="section-heading text-slate-900 dark:text-slate-100">Profile details</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Input placeholder="Full name" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} />
          <Input placeholder="Email" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} />
          <Input placeholder="Phone" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
          <Input placeholder="Location" value={profileForm.location} onChange={(event) => setProfileForm((current) => ({ ...current, location: event.target.value }))} />
        </div>
        <Input className="mt-4" placeholder="Avatar image URL" value={profileForm.avatarUrl} onChange={(event) => setProfileForm((current) => ({ ...current, avatarUrl: event.target.value }))} />
        <Textarea className="mt-4 min-h-[140px]" placeholder="Short bio" value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} />
        {profileError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{profileError}</div> : null}
        <Button className="site-primary-button mt-5" disabled={updateProfileMutation.isPending} onClick={handleSaveProfile}>
          {updateProfileMutation.isPending ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </section>
  );
}

export default function UserProfilePage() {
  return (
    <UserWorkspaceFrame
      title="Profile"
      subtitle="Keep your account details, avatar, and personal context updated in one dedicated profile route."
    >
      {({ profile, initials }) => <UserProfileContent initials={initials} profile={profile} />}
    </UserWorkspaceFrame>
  );
}
