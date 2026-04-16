"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface PasswordGateCardProps {
  kicker?: string;
  title: string;
  description: string;
  credentialId: string;
  password: string;
  error?: string;
  placeholder: string;
  submitLabel: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  backHref?: string;
  backLabel?: string;
}

export function PasswordGateCard({
  kicker,
  title,
  description,
  credentialId,
  password,
  error,
  placeholder,
  submitLabel,
  onPasswordChange,
  onSubmit,
  backHref,
  backLabel,
}: PasswordGateCardProps) {
  return (
    <div className="auth-gate">
      <div className="card__header">
        {kicker ? <p className="app-header__kicker">{kicker}</p> : null}
        <h2 className="card__title">{title}</h2>
        <p className="card__desc">{description}</p>
      </div>
      <div className="card__content auth-gate__content">
        <form onSubmit={onSubmit} className="auth-gate__form" autoComplete="on">
          <Input
            type="text"
            name="username"
            autoComplete="username"
            value={credentialId}
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            className="sr-only"
          />
          <div className="auth-gate__field">
            <Label htmlFor="password-gate-input">Password</Label>
            <Input
              id="password-gate-input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder={placeholder}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              required
            />
          </div>
          <Button type="submit">{submitLabel}</Button>
        </form>
        {error ? <p className="auth-gate__error">{error}</p> : null}
        {backHref && backLabel ? (
          <Link className="btn btn--outline" href={backHref}>
            {backLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
