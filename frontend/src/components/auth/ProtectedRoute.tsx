import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { Navbar } from "../layout/Navbar";

interface ProtectedRouteProps {
  children: ReactNode;
  hideNavbar?: boolean;
}

export function ProtectedRoute({ children, hideNavbar }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111315] text-vscode-muted">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      {!hideNavbar && <Navbar />}
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
