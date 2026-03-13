import { Link } from "react-router-dom";
import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
}

export function AuthCard({
  title,
  subtitle,
  children,
  footerText,
  footerLinkHref,
  footerLinkText,
}: AuthCardProps) {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-vscode-border bg-vscode-panel p-6 shadow-xl">
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <p className="mt-1 text-sm text-vscode-muted">{subtitle}</p>
      <div className="mt-6 space-y-4">{children}</div>
      <p className="mt-6 text-sm text-vscode-muted">
        {footerText}{" "}
        <Link className="text-vscode-blue hover:underline" to={footerLinkHref}>
          {footerLinkText}
        </Link>
      </p>
    </div>
  );
}
