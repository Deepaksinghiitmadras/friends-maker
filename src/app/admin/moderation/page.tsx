import { getUnapprovedPhotos } from "@/app/actions/adminActions";
import MemberPhotos from "@/components/MemberPhotos";
import { Divider } from "@nextui-org/react";
import UserManagementPanel from "./UserManagementPanel";

export const dynamic = "force-dynamic";

export default async function PhotoModerationPage() {
  const photos = await getUnapprovedPhotos();
  return (
    <div className="flex flex-col mt-10 gap-3">
      {/* ── User Management ── */}
      <h3 className="text-2xl font-semibold">User Management</h3>
      <p className="text-gray-500 text-sm">Block or permanently delete user accounts. Admin accounts are protected.</p>
      <UserManagementPanel />

      <Divider className="my-6" />

      {/* ── Photo Moderation ── */}
      <h3 className="text-2xl font-semibold">Photos Awaiting Moderation</h3>
      <Divider />
      <MemberPhotos photos={photos} />
    </div>
  );
}
