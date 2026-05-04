import { Loader2, Lock, Globe, X } from "lucide-react";
import { useState } from "react";
import api from "../lib/api";

interface CreateProjectModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateProjectModal({ onClose, onSuccess }: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await api.post("/projects", {
        name: name.trim(),
        description: description.trim(),
        isPublic,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div 
        className="w-full max-w-md overflow-hidden rounded-xl border border-vscode-border bg-vscode-bg shadow-2xl transition-all duration-300"
      >
        <div className="flex items-center justify-between border-b border-vscode-border px-6 py-4">
          <h2 className="text-xl font-semibold text-white">Create New Project</h2>
          <button 
            onClick={onClose}
            className="rounded-md p-1 text-vscode-muted transition hover:bg-vscode-panel hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-vscode-text" htmlFor="name">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Awesome App"
              className="w-full rounded-md border border-vscode-border bg-[#111315] px-3 py-2.5 text-sm text-white placeholder-vscode-muted transition focus:border-vscode-blue focus:outline-none focus:ring-1 focus:ring-vscode-blue"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-vscode-text" htmlFor="description">
              Description <span className="text-vscode-muted">(Optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
              className="w-full resize-none rounded-md border border-vscode-border bg-[#111315] px-3 py-2 text-sm text-white placeholder-vscode-muted transition focus:border-vscode-blue focus:outline-none focus:ring-1 focus:ring-vscode-blue"
            />
          </div>

          <div className="space-y-3 pt-2">
            <label className="text-sm font-medium text-vscode-text">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label 
                className={`relative flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors ${
                  !isPublic ? 'border-vscode-blue bg-vscode-blue/10' : 'border-vscode-border bg-[#111315] hover:border-vscode-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lock className={`h-4 w-4 ${!isPublic ? 'text-vscode-blue' : 'text-vscode-muted'}`} />
                  <span className={`text-sm font-medium ${!isPublic ? 'text-vscode-blue' : 'text-white'}`}>Private</span>
                </div>
                <p className="mt-1 text-xs text-vscode-muted">Only invited members can view or edit.</p>
                <input 
                  type="radio" 
                  name="visibility" 
                  className="sr-only" 
                  checked={!isPublic} 
                  onChange={() => setIsPublic(false)} 
                />
              </label>

              <label 
                className={`relative flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors ${
                  isPublic ? 'border-vscode-blue bg-vscode-blue/10' : 'border-vscode-border bg-[#111315] hover:border-vscode-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className={`h-4 w-4 ${isPublic ? 'text-vscode-blue' : 'text-vscode-muted'}`} />
                  <span className={`text-sm font-medium ${isPublic ? 'text-vscode-blue' : 'text-white'}`}>Public</span>
                </div>
                <p className="mt-1 text-xs text-vscode-muted">Anyone can view. Only members can edit.</p>
                <input 
                  type="radio" 
                  name="visibility" 
                  className="sr-only" 
                  checked={isPublic} 
                  onChange={() => setIsPublic(true)} 
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-vscode-border/50 pt-4">
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
              disabled={loading || !name.trim()}
              className="flex min-w-[100px] items-center justify-center rounded-md bg-vscode-blue px-5 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
