import { Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export function Navbar() {
  const { user } = useAuth();
  const location = useLocation();

  const isDashboard = location.pathname === "/dashboard";

  return (
    <nav className="flex items-center justify-between border-b border-vscode-border bg-vscode-panel px-6 py-3 sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-white hover:opacity-80">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#29b6f6]" />
          Colab Code
        </Link>
        <Link
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isDashboard
              ? "bg-[#2a2d2e] text-white"
              : "text-vscode-muted hover:bg-[#2a2d2e] hover:text-white"
          }`}
          to="/dashboard"
        >
          <Home className="mr-1.5 inline h-4 w-4" />
          Home
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-md px-3 py-1.5 hover:bg-[#2a2d2e] transition-colors"
        >
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-white">{user?.username ?? "Developer"}</span>
            <span className="text-xs text-vscode-muted">{user?.email ?? ""}</span>
          </div>
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt="Avatar"
              className="h-9 w-9 rounded-full object-cover border border-vscode-border"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3a3d41] text-sm font-semibold text-white border border-vscode-border">
              {(user?.username || "U").slice(0, 1).toUpperCase()}
            </div>
          )}
        </Link>
      </div>
    </nav>
  );
}
