import { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import api from "../lib/api";

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
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
    <main className="min-h-screen bg-[#111315] px-4 py-10 text-vscode-text">
      <div className="mx-auto max-w-3xl rounded-xl border border-vscode-border bg-vscode-panel p-6">
        <div className="mb-4">
          <Link className="text-sm text-vscode-blue hover:underline" to="/dashboard">
            ← Back to dashboard
          </Link>
        </div>
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3a3d41] text-2xl font-semibold text-white">
            {(username || "U").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Your Profile</h1>
            <p className="text-sm text-vscode-muted">Manage your identity and preferred tools.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="mt-6 flex items-center gap-3">
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
    </main>
  );
}
