import * as React from "react";
import { cn } from "@/lib/utils";

export const textareaClassName =
  "flex min-h-[92px] w-full rounded-(--radius-input) border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:pl-0 disabled:opacity-100 disabled:text-slate-900 disabled:resize-none";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(textareaClassName, className)}
      ref={ref}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
