import { useSyncExternalStore } from "react";
import { isActiveTab } from "../lib/activeTab";
import { loadFollowAi, subscribeFollowAi } from "../lib/followAi";

// Will this tab be pointed at an AI edit (FollowAiEdits)? If so, the page keeps
// showing the old text until it gets there (useRecentChanges' hold).
export function useHoldForAi(): boolean {
  const follow = useSyncExternalStore(subscribeFollowAi, loadFollowAi);
  return follow && isActiveTab();
}
