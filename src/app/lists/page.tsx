import React from "react";
import {
  fetchCurrentUserLikeIds,
  fetchLikedMembers,
} from "../actions/likeActions";
import ListsTab from "./ListsTab";

export const dynamic = "force-dynamic";

export default async function ListsPage({
  searchParams,
}: {
  searchParams: { type: string };
}) {
  const [likeIds, members] = await Promise.all([
    fetchCurrentUserLikeIds(),
    fetchLikedMembers(searchParams.type),
  ]);

  return (
    <div>
      <ListsTab
        members={members}
        likeIds={likeIds}
      />
    </div>
  );
}
