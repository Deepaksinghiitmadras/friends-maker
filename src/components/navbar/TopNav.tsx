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

export default async function TopNav() {
  const session = await auth();
  const userInfo = session?.user ? await getUserInfoForNav() : null;

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
    { href: "/lists", label: "Lists" },
    { href: "/messages", label: "Messages" },
    { href: "/virtual", label: "Virtual Dating" },
  ];

  const adminLinks = [
    {
      href: "/admin/virtual-companions",
      label: "🤖 Companion Studio",
    },
    {
      href: "/admin/moderation",
      label: "Photo Moderation",
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
        className="bg-gradient-to-r from-pink-400 via-red-400 to-pink-600"
        classNames={{
          item: [
            "text-xl",
            "text-white",
            "uppercase",
            "data-[active=true]:text-yellow-200",
          ],
        }}
      >
        <NavbarBrand as={Link} href="/">
          <GiSelfLove
            size={40}
            className="text-gray-200"
          />
          <div className="font-bold text-3xl flex items-center">
            <span className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              TrueFriends
            </span>
          </div>
        </NavbarBrand>
        <NavbarContent justify="center">
          {session &&
            links.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
              />
            ))}
        </NavbarContent>
        <NavbarContent justify="end">
          {currentUser ? (
            <UserMenu userInfo={currentUser} />
          ) : (
            <>
              <Button
                as={Link}
                href="/login"
                variant="bordered"
                className="text-white"
              >
                Login
              </Button>
              <Button
                as={Link}
                href="/register"
                variant="bordered"
                className="text-white"
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
