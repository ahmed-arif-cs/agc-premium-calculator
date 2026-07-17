import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = {
  title: "Profile — AGC Premium Calculator",
  description:
    "Manage your AGC Premium Calculator profile — avatar, name, email, account information, and account settings.",
};

export default function ProfilePage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="calc-bg-glow" aria-hidden />
      <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-10">
        <ProfileView />
      </main>
    </div>
  );
}
