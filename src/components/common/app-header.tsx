"use client";

import { ReactNode } from "react";

interface AppHeaderProps {
  kicker: string;
  title: string;
  description: string;
  actions: ReactNode;
}

export function AppHeader({
  kicker,
  title,
  description,
  actions,
}: AppHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
          {kicker}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </header>
  );
}
