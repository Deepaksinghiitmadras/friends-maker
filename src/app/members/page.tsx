import React from "react";
import { getMembers } from "../actions/memberActions";
import MemberCard from "./MemberCard";
import { fetchCurrentUserLikeIds } from "../actions/likeActions";
import PaginationComponent from "@/components/PaginationComponent";
import { GetMemberParams } from "@/types";
import EmptyState from "@/components/EmptyState";

// This page reads auth session (headers/cookies) so it must be dynamic
export const dynamic = 'force-dynamic';

export default async function MembersPage({
  searchParams,
}: {
  searchParams: GetMemberParams;
}) {
  const [{ items: members, totalCount }, likeIds] = await Promise.all([
    getMembers(searchParams),
    fetchCurrentUserLikeIds(),
  ]);

  if (members.length === 0) return <EmptyState />;

  return (
    <>
      <div className="mt-6 md:mt-10 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-8">
        {members &&
          members.map((member) => (
            <MemberCard
              member={member}
              key={member.id}
              likeIds={likeIds}
            />
          ))}
      </div>
      <PaginationComponent
        totalCount={totalCount}
      />
    </>
  );
}
