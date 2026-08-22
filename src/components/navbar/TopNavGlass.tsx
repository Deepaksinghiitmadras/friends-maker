import {
  Button,
  Navbar,
  NavbarBrand,
  NavbarContent,
} from "@nextui-org/react";
import Link from "next/link";
import React from "react";
import { GiSelfLove } from "react-icons/gi";
import NavLink from "./NavLink";
import { auth } from "@/auth";
import UserMenu from "./UserMenu";
import { getUserInfoForNav } from "@/app/actions/userActions";
import FiltersWrapper from "./FiltersWrapper";
import ModeToggle from "./ModeToggle";

export default async function TopNavGlass() {
  let session: any = null;
  let userInfo: any = null;

  try {
    session = await auth();
    userInfo = session?.user ? await getUserInfoForNav() : null;
  } catch (err) {
    console.warn('[TopNavGlass] Database connection warning:', err);
  }

  const currentUser = session?.user
    ? {
        name: userInfo?.name || session.user.name || session.user.email || 'User',
        image: userInfo?.image || session.user.image || null,
        role: ((session.user as any)?.role as string) || 'MEMBER',
      }
    : null;

  const isAdmin = currentUser?.role === 'ADMIN';

  const memberLinks = [
    { href: "/members", label: "Matches" },
    { href: "/groups", label: "👥 Groups" },
    { href: "/messages", label: "Messages" },
    { href: "/lists", label: "Lists" },
    { href: "/virtual", label: "Virtual Dating" },
  ];

  const adminLinks = [
    {
      href: "/admin/virtual-companions",
      label: "🤖 Companion Studio",
    },
    {
      href: "/admin/analytics",
      label: "📊 Audience & Users",
    },
    {
      href: "/groups",
      label: "👥 Groups",
    },
    {
      href: "/admin/moderation",
      label: "🖼️ Photo Moderation",
    },
    {
      href: "/virtual",
      label: "Virtual Dating",
    },
    {
      href: "/members",
      label: "Matches",
    },
  ];

  const links = isAdmin ? adminLinks : memberLinks;

  return (
    <>
      <Navbar
        maxWidth="full"
        className="bg-white/70 backdrop-blur-xl border-b border-gray-200/60 shadow-sm relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/80 before:to-gray-50/30 overflow-x-auto"
        classNames={{
          item: [
            "text-xs",
            "sm:text-sm",
            "md:text-base",
            "text-slate-800",
            "font-semibold",
            "tracking-normal",
            "transition-all",
            "duration-200",
            "hover:text-slate-900",
            "hover:bg-black/5",
            "rounded-lg",
            "px-2",
            "sm:px-3",
            "py-1",
            "whitespace-nowrap",
            "data-[active=true]:text-pink-600",
            "data-[active=true]:font-bold",
            "data-[active=true]:bg-pink-50/60",
          ],
          wrapper: "px-2 sm:px-4 md:px-6 relative z-10 gap-2 sm:gap-4 overflow-x-auto flex-nowrap",
        }}
      >
        <NavbarBrand as={Link} href="/" className="gap-1.5 sm:gap-3 shrink-0">
          <GiSelfLove
            size={28}
            className="text-pink-500 drop-shadow-sm"
          />
          <div className="font-bold text-base sm:text-2xl flex items-center">
            <span className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
              TrueFriends
            </span>
          </div>
        </NavbarBrand>
        <NavbarContent justify="center" className="gap-1 sm:gap-2 md:gap-4 overflow-x-auto flex-nowrap max-w-full">
          <ModeToggle />
          {session &&
            links.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
              />
            ))}
        </NavbarContent>
        <NavbarContent justify="end" className="gap-3">
          {currentUser ? (
            <UserMenu userInfo={currentUser} />
          ) : (
            <>
              <Button
                as={Link}
                href="/login"
                variant="bordered"
                className="border-gray-300/80 text-slate-700 bg-white/60 backdrop-blur-md hover:bg-white/80 hover:border-gray-400/80 transition-all duration-200 font-medium shadow-sm rounded-lg"
                size="sm"
              >
                Login
              </Button>
              <Button
                as={Link}
                href="/register"
                variant="solid"
                className="bg-pink-500/90 backdrop-blur-md text-white border-0 hover:bg-pink-600 transition-all duration-200 font-medium shadow-md rounded-lg hover:shadow-lg"
                size="sm"
              >
                Register
              </Button>
            </>
          )}
        </NavbarContent>
      </Navbar>
      <FiltersWrapper />
    </>
  );
}