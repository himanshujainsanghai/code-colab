import { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import api from "../lib/api";

export function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const [stack, setStack] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setUsername(user?.username ?? "");
    setAvatar(user?.avatar ?? "");
    setStack(user?.techStack ?? []);
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.patch("/auth/me", {
        username: username.trim(),
        avatar: avatar.trim(),
        techStack: stack,
      });
      await refreshUser();
      setMessage("Profile updated.");
    } catch (error) {
      const fallback = "Could not update profile.";
      const serverMessage = error instanceof AxiosError ? error.response?.data?.message : null;
      setMessage(serverMessage ?? fallback);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex-1 bg-[#111315] px-4 py-10 text-vscode-text w-full">
      <div className="mx-auto max-w-3xl rounded-xl border border-vscode-border bg-vscode-panel p-6 shadow-lg">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3a3d41] text-2xl font-semibold text-white overflow-hidden border border-vscode-border">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                (user?.username || "U").slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{user?.username ?? "Developer"}</h1>
              <p className="text-sm text-vscode-muted">{user?.email}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {stack.slice(0, 3).map((item) => (
                  <span key={item} className="rounded-full bg-[#1e1e1e] px-2 py-0.5 text-[10px] uppercase tracking-wider text-vscode-muted border border-vscode-border">
                    {item}
                  </span>
                ))}
                {stack.length > 3 && (
                  <span className="rounded-full bg-[#1e1e1e] px-2 py-0.5 text-[10px] uppercase tracking-wider text-vscode-muted border border-vscode-border">
                    +{stack.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <button
            className="rounded-md border border-vscode-border px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            type="button"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        <div className="border-t border-vscode-border pt-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Edit Profile</h2>
            <p className="text-sm text-vscode-muted mt-1">Update your personal information and preferences.</p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2">
          <label className="text-sm text-vscode-muted">
            Username
            <input
              className="mt-1 w-full rounded-md border border-vscode-border bg-[#1e1e1e] px-3 py-2 text-sm"
              onChange={(event) => setUsername(event.target.value)}
              value={username}
            />
          </label>
          <label className="text-sm text-vscode-muted">
            Avatar URL
            <input
              className="mt-1 w-full rounded-md border border-vscode-border bg-[#1e1e1e] px-3 py-2 text-sm"
              onChange={(event) => setAvatar(event.target.value)}
              placeholder="https://..."
              value={avatar}
            />
          </label>
        </div>

        <div className="mt-8">
          <h2 className="text-sm uppercase tracking-wide text-vscode-muted">My Tech Stack</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {stack.map((item) => (
              <span key={item} className="rounded-full border border-vscode-border bg-[#1e1e1e] px-3 py-1 text-xs text-white">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-md border border-vscode-border bg-[#1e1e1e] px-3 py-2 text-sm"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Add stack item"
              value={input}
            />
            <button
              className="rounded-md bg-vscode-blue px-3 py-2 text-sm text-white"
              onClick={() => {
                if (input.trim()) {
                  setStack((prev) => [...prev, input.trim()]);
                  setInput("");
                }
              }}
              type="button"
            >
              Add
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-vscode-border pt-6 flex items-center gap-3">
          <button
            className="rounded-md bg-vscode-blue px-4 py-2 text-sm text-white disabled:opacity-60"
            disabled={saving}
            onClick={saveProfile}
            type="button"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
          {message && <p className="text-xs text-vscode-muted">{message}</p>}
        </div>
        </div>
      </div>
    </main>
  );
}
