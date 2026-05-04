import { Loader2, Search, X, User, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import api from "../lib/api";

interface InviteUserModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

interface SearchedUser {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
}

export function InviteUserModal({ projectId, projectName, onClose }: InviteUserModalProps) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"viewer" | "editor" | "admin">("editor");
  
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);

  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    
    debounceTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
        setResults(response.data.data);
      } catch (err) {
        console.error("Failed to search users", err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const response = await api.post(`/projects/${projectId}/invitations`, {
        userId: selectedUser.id,
        role,
      });
      
      const inviteLink = response.data.data.inviteLink as string;
      if (navigator.clipboard && inviteLink) {
        await navigator.clipboard.writeText(inviteLink);
        setSuccessMessage("Invitation sent & link copied to clipboard!");
      } else {
        setSuccessMessage("Invitation sent successfully!");
      }
      
      // Keep it open for a moment to show success, then close or let user close
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send invitation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-vscode-border bg-vscode-bg shadow-2xl transition-all duration-300">
        <div className="flex items-center justify-between border-b border-vscode-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Invite User</h2>
            <p className="mt-1 text-xs text-vscode-muted">to <span className="font-medium text-vscode-text">{projectName}</span></p>
          </div>
          <button 
            onClick={onClose}
            className="rounded-md p-1 text-vscode-muted transition hover:bg-vscode-panel hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              {successMessage}
            </div>
          )}

          <div className="space-y-8">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-vscode-text">
                Search User
              </label>
              
              {!selectedUser ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-vscode-muted" />
                  </div>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by username or email..."
                    autoFocus
                    className="w-full rounded-md border border-vscode-border bg-[#111315] pl-10 pr-3 py-2 text-sm text-white placeholder-vscode-muted transition focus:border-vscode-blue focus:outline-none focus:ring-1 focus:ring-vscode-blue"
                  />
                  {searchLoading && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <Loader2 className="h-4 w-4 animate-spin text-vscode-muted" />
                    </div>
                  )}

                  {/* Dropdown Results */}
                  {query.trim() && results.length > 0 && (
                    <div className=" max-h-48 overflow-y-auto rounded-md border border-vscode-border bg-[#111315] shadow-inner">
                      {results.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setSelectedUser(u)}
                          className="flex w-full items-center gap-3 px-3 py-2 hover:bg-vscode-blue/10 transition text-left"
                        >
                          {u.avatar ? (
                            <img src={u.avatar} alt="Avatar" className="h-6 w-6 rounded-full object-cover border border-vscode-border" />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-vscode-panel border border-vscode-border">
                              <User className="h-3 w-3 text-vscode-muted" />
                            </div>
                          )}
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium text-white truncate">{u.username}</span>
                            {u.email && <span className="text-xs text-vscode-muted truncate">{u.email}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {query.trim() && !searchLoading && results.length === 0 && (
                    <div className="mt-2 rounded-md border border-vscode-border bg-[#111315] px-3 py-4 text-center shadow-inner">
                      <p className="text-xs text-vscode-muted">No users found.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-md border border-vscode-blue/50 bg-vscode-blue/10 p-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {selectedUser.avatar ? (
                      <img src={selectedUser.avatar} alt="Avatar" className="h-8 w-8 rounded-full object-cover border border-vscode-border" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-vscode-panel border border-vscode-border">
                        <User className="h-4 w-4 text-vscode-muted" />
                      </div>
                    )}
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium text-white truncate">{selectedUser.username}</span>
                      {selectedUser.email && <span className="text-xs text-vscode-muted truncate">{selectedUser.email}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(null);
                      setQuery("");
                    }}
                    className="rounded-md p-1.5 text-vscode-muted hover:bg-vscode-panel hover:text-white transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-vscode-text">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full rounded-md border border-vscode-border bg-[#111315] px-3 py-2 text-sm text-white focus:border-vscode-blue focus:outline-none focus:ring-1 focus:ring-vscode-blue"
              >
                <option value="viewer">Viewer (Read-only)</option>
                <option value="editor">Editor (Can modify code)</option>
                <option value="admin">Admin (Full access)</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-vscode-border/50 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md px-4 py-2 text-sm font-medium text-vscode-text transition hover:bg-vscode-panel hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedUser}
              className="flex min-w-[120px] items-center justify-center rounded-md bg-vscode-blue px-5 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
