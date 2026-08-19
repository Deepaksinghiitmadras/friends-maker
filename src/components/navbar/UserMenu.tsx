"use client";

import { signOutUser } from "@/app/actions/authActions";
import {
  Avatar,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Chip,
} from "@nextui-org/react";
import Link from "next/link";
import React from "react";
import { FaUserCircle, FaSignOutAlt, FaShieldAlt, FaRobot, FaImages } from "react-icons/fa";

type Props = {
  userInfo: {
    name: string | null;
    image: string | null;
    role?: string;
  } | null;
};

export default function UserMenu({ userInfo }: Props) {
  const isAdmin = userInfo?.role === 'ADMIN';

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <div className="flex items-center gap-2 cursor-pointer p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all">
          <Avatar
            isBordered
            color={isAdmin ? "secondary" : "default"}
            name={userInfo?.name || "User"}
            size="sm"
            src={userInfo?.image || "/images/user.png"}
            className="transition-transform"
          />
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight">
              {userInfo?.name || "User"}
            </span>
            <span className="text-[10px] text-gray-500 font-medium">
              {isAdmin ? "👑 Admin" : "Member"}
            </span>
          </div>
        </div>
      </DropdownTrigger>
      <DropdownMenu variant="flat" aria-label="User actions menu" className="p-2">
        <DropdownSection showDivider>
          <DropdownItem
            isReadOnly
            key="profile_info"
            className="h-14 gap-2"
            textValue={userInfo?.name || 'User Profile'}
          >
            <p className="font-semibold text-xs text-gray-500">Signed in as</p>
            <p className="font-bold text-sm text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <span>{userInfo?.name}</span>
              {isAdmin && (
                <Chip size="sm" color="secondary" variant="flat" className="text-[10px] h-5 font-bold">
                  ADMIN
                </Chip>
              )}
            </p>
          </DropdownItem>
        </DropdownSection>

        {isAdmin ? (
          <DropdownSection title="Admin Management" showDivider>
            <DropdownItem
              key="admin_studio"
              as={Link}
              href="/admin/virtual-companions"
              startContent={<FaRobot className="text-purple-500 text-sm" />}
            >
              Companion Studio
            </DropdownItem>
            <DropdownItem
              key="admin_moderation"
              as={Link}
              href="/admin/moderation"
              startContent={<FaImages className="text-pink-500 text-sm" />}
            >
              Photo Moderation
            </DropdownItem>
          </DropdownSection>
        ) : (
          <DropdownSection showDivider>
            <DropdownItem
              key="edit_profile"
              as={Link}
              href="/members/edit"
              startContent={<FaUserCircle className="text-gray-500 text-sm" />}
            >
              Edit profile
            </DropdownItem>
          </DropdownSection>
        )}

        <DropdownSection>
          <DropdownItem
            key="logout"
            color="danger"
            className="text-danger font-semibold"
            startContent={<FaSignOutAlt className="text-sm" />}
            onClick={async () => {
              await signOutUser();
              window.location.href = '/login';
            }}
          >
            Log out
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  );
}
