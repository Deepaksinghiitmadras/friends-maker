"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Chip, Divider, Spinner, Tooltip } from "@nextui-org/react";
import { toast } from "react-toastify";
import { FiTrash2, FiSlash, FiCheckCircle, FiRefreshCw } from "react-icons/fi";

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: string | null;
  role: string;
  profileComplete: boolean;
  isBlocked: boolean;
  member: { city: string | null; country: string | null; gender: string | null } | null;
};

export default function UserManagementPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const setAction = (id: string, val: boolean) =>
    setActionLoading((prev) => ({ ...prev, [id]: val }));

  const handleBlock = async (user: UserRow) => {
    setAction(user.id, true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, isBlocked: !user.isBlocked }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(user.isBlocked ? `${user.name} unblocked` : `${user.name} blocked`);
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, isBlocked: !u.isBlocked } : u));
      } else {
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setAction(user.id, false);
    }
  };

  const handleDelete = async (user: UserRow) => {
    if (!confirm(`Permanently delete account for ${user.email}? This cannot be undone.`)) return;
    setAction(user.id, true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Account ${user.email} deleted`);
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setAction(user.id, false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">All Users ({users.length})</h3>
        <Button
          size="sm"
          variant="flat"
          startContent={<FiRefreshCw size={14} />}
          onPress={fetchUsers}
          isLoading={loading}
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${user.isBlocked ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{user.name || "—"}</div>
                    <div className="text-gray-400 text-xs">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Chip
                      size="sm"
                      color={user.role === "ADMIN" ? "secondary" : "default"}
                      variant="flat"
                    >
                      {user.role}
                    </Chip>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {user.isBlocked && <Chip size="sm" color="danger" variant="flat">Blocked</Chip>}
                      {!user.emailVerified && <Chip size="sm" color="warning" variant="flat">Unverified</Chip>}
                      {user.emailVerified && !user.isBlocked && (
                        <Chip size="sm" color="success" variant="flat">Active</Chip>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {user.member ? `${user.member.city || "—"}, ${user.member.country || "—"}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {user.role !== "ADMIN" && (
                        <>
                          <Tooltip content={user.isBlocked ? "Unblock user" : "Block user"}>
                            <Button
                              size="sm"
                              variant="flat"
                              color={user.isBlocked ? "success" : "warning"}
                              isIconOnly
                              isLoading={actionLoading[user.id]}
                              onPress={() => handleBlock(user)}
                            >
                              {user.isBlocked ? <FiCheckCircle size={16} /> : <FiSlash size={16} />}
                            </Button>
                          </Tooltip>
                          <Tooltip content="Delete account permanently">
                            <Button
                              size="sm"
                              variant="flat"
                              color="danger"
                              isIconOnly
                              isLoading={actionLoading[user.id]}
                              onPress={() => handleDelete(user)}
                            >
                              <FiTrash2 size={16} />
                            </Button>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
