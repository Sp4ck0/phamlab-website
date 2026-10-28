import { useEffect } from "react";
import { saveLastTab } from "../lib/lastTab";

/** Remember `path` as the last visited tab once its page has loaded authorized content. */
export function useRememberTab(path: string | null) {
  useEffect(() => {
    if (path) saveLastTab(path);
  }, [path]);
}
