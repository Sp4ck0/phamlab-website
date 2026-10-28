import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";

export interface VersionLogEntry {
  _id: string;
  area: "board" | "trips" | "dating" | "manage" | "general" | "other";
  version: string;
  title: string;
  notes?: string;
  links: { label: string; url: string }[];
  date: string;
}

export function useVersionLog() {
  const { code } = useAccessCode();
  const entries = useQuery(api.versionLog.list, { code }) as VersionLogEntry[] | undefined;
  return { entries, isLoading: entries === undefined };
}
