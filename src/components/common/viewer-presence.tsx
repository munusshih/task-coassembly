"use client";

import { Users } from "lucide-react";

function initialsFromSeed(seed: string): string {
  return seed.slice(-2).toUpperCase();
}

interface ViewerPresenceProps {
  count: number;
  seeds: string[];
  label: string;
}

export function ViewerPresence({ count, seeds, label }: ViewerPresenceProps) {
  return (
    <div className="presence">
      <div className="presence__avatars">
        {seeds.length ? (
          seeds.map((seed) => (
            <span key={seed} className="presence__avatar">
              {initialsFromSeed(seed)}
            </span>
          ))
        ) : (
          <span className="presence__avatar--empty">
            <Users className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="presence__info">
        <p className="presence__count">
          {count} {count === 1 ? "viewer" : "viewers"}
        </p>
        <p className="presence__label">{label}</p>
      </div>
    </div>
  );
}
