"use client";

import { ReactNode } from "react";

interface AppHeaderProps {
  kicker: string;
  title: string;
  description: string;
  meta?: ReactNode;
  actions: ReactNode;
}

export function AppHeader({
  kicker,
  title,
  description,
  meta,
  actions,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__body">
          <p className="app-header__kicker">{kicker}</p>
          <div className="app-header__heading">
            <h1 className="t-h1">{title}</h1>
            <p className="app-header__desc">{description}</p>
          </div>
          {meta ? <div className="app-header__meta">{meta}</div> : null}
        </div>
        <div className="app-header__actions">{actions}</div>
      </div>
    </header>
  );
}
