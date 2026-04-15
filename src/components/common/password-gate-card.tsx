"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonBaseClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <Card className="mx-auto mt-16 w-full max-w-md">
      <CardHeader>
        {kicker ? (
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            {kicker}
          </p>
        ) : null}
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3" autoComplete="on">
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
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder={placeholder}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            required
          />
          <Button type="submit">{submitLabel}</Button>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        {backHref && backLabel ? (
          <Link
            className={cn(buttonBaseClass, "mt-3 h-10 border border-slate-200 bg-white px-4 py-2 text-slate-900 hover:bg-slate-50")}
            href={backHref}
          >
            {backLabel}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
