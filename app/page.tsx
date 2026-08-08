"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "../src/components/ui/skeleton";

const AppShell = dynamic(
  () => import("../src/components/AppShell").then((m) => m.AppShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen flex-col bg-background p-4 space-y-4">
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-16" />
        </div>
        <div className="flex flex-1 gap-4 overflow-hidden">
          <Skeleton className="h-full w-64" />
          <Skeleton className="h-full flex-1" />
          <Skeleton className="h-full w-80" />
        </div>
      </div>
    ),
  },
);

export default function Home() {
  return <AppShell />;
}
