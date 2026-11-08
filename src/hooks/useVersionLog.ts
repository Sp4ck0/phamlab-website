import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "./useAccessCode";

export interface VersionLogEntry {
  _id: string;
  _creationTime: number;
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

// How many visible entries are newer than what this grant has opened, and the
// _creationTime marker that count is measured from.
export function useVersionLogUnseen() {
  const { code } = useAccessCode();
  return useQuery(api.versionLog.unseen, { code }) as { count: number; seenAt: number } | undefined;
}

export function useMarkVersionLogSeen() {
  const { code } = useAccessCode();
  const mark = useMutation(api.versionLog.markSeen);
  return (through: number) => mark({ code, through });
}
