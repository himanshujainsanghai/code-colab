import { ArrowRight, FolderKanban, Home, LogOut, Plus, UserCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import api from "../lib/api";

interface DashboardProject {
  _id: string;
  name: string;
  description: string;
  updatedAt: string;
  role: "viewer" | "editor" | "admin";
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/projects");
      const list = response.data.data.projects as DashboardProject[];
      setProjects(list);
    } catch {
      setError("Could not load projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const initials = useMemo(() => user?.username?.slice(0, 1).toUpperCase() ?? "U", [user]);

  const createProject = async () => {
    const name = window.prompt("Project name", "New Project");
    if (!name?.trim()) return;
    setCreating(true);
    try {
      await api.post("/projects", {
        name: name.trim(),
        description: "Created from dashboard",
      });
      await loadProjects();
    } finally {
      setCreating(false);
    }
  };

  const inviteToProject = async (project: DashboardProject) => {
    setInviteMessage(null);
    const email = window.prompt(`Invite user to ${project.name} (email)`);
    if (!email) return;
    const roleInput = window.prompt("Role: viewer | editor | admin", "editor");
    const role = roleInput === "viewer" || roleInput === "admin" || roleInput === "editor" ? roleInput : "editor";

    try {
      const response = await api.post(`/projects/${project._id}/invitations`, {
        invitedEmail: email.trim(),
        role,
      });
      const inviteLink = response.data.data.inviteLink as string;
      if (navigator.clipboard && inviteLink) {
        await navigator.clipboard.writeText(inviteLink);
        setInviteMessage("Invitation sent. Link copied to clipboard.");
      } else {
        setInviteMessage("Invitation sent.");
      }
    } catch {
      setInviteMessage("Could not send invitation.");
    }
  };

  return (
    <main className="min-h-screen bg-[#111315] px-6 py-8 text-vscode-text">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-6 flex items-center justify-between rounded-xl border border-vscode-border bg-vscode-panel px-4 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#29b6f6]" />
              Colab Code
            </div>
            <Link className="rounded-md px-2 py-1 text-sm text-vscode-muted hover:bg-[#2a2d2e] hover:text-white" to="/dashboard">
              <Home className="mr-1 inline h-4 w-4" />
              Home
            </Link>
            <Link className="rounded-md px-2 py-1 text-sm text-vscode-muted hover:bg-[#2a2d2e] hover:text-white" to="/profile">
              <UserCircle2 className="mr-1 inline h-4 w-4" />
              Profile
            </Link>
            <span className="rounded-md px-2 py-1 text-sm text-vscode-blue">
              <FolderKanban className="mr-1 inline h-4 w-4" />
              Projects
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-vscode-muted sm:inline">
              Signed in as <span className="text-white">{user?.username ?? "Developer"}</span>
            </span>
            <button
              className="rounded-md border border-vscode-border px-3 py-1.5 text-sm text-vscode-muted hover:bg-[#2a2d2e] hover:text-white"
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
              type="button"
            >
              <LogOut className="mr-1 inline h-4 w-4" />
              Sign Out
            </button>
          </div>
        </nav>

        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-vscode-muted">Welcome back, {user?.username ?? "Developer"}</p>
            <h1 className="text-2xl font-bold text-white">Your Projects</h1>
          </div>
          <button
            className="rounded-md bg-vscode-blue px-4 py-2 text-sm text-white hover:brightness-110 disabled:opacity-60"
            disabled={creating}
            onClick={createProject}
            type="button"
          >
            <Plus className="mr-1 inline h-4 w-4" />
            {creating ? "Creating..." : "New Project"}
          </button>
        </header>

        {loading && <p className="mb-4 text-sm text-vscode-muted">Loading projects...</p>}
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {inviteMessage && <p className="mb-4 text-sm text-vscode-blue">{inviteMessage}</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project._id}
              className="rounded-xl border border-vscode-border bg-vscode-panel p-4 transition hover:border-vscode-blue"
            >
              <Link className="block" to={`/project/${project._id}`}>
                <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                <p className="mt-1 text-sm text-vscode-muted">{project.description || "No description yet."}</p>
              </Link>
              <p className="mt-3 text-xs text-vscode-muted">
                Updated {new Date(project.updatedAt).toLocaleString()}
              </p>
              <Link className="mt-3 flex items-center gap-1 text-xs text-vscode-blue" to={`/project/${project._id}`}>
                Open workspace
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3a3d41] text-xs font-semibold">
                  {initials}
                </div>
                <span className="rounded-md bg-[#222] px-2 py-1 text-xs uppercase text-vscode-muted">
                  {project.role}
                </span>
                {(project.role === "admin") && (
                  <button
                    className="ml-auto rounded-md border border-vscode-border px-2 py-1 text-xs text-vscode-muted hover:bg-[#2a2d2e] hover:text-white"
                    onClick={() => void inviteToProject(project)}
                    type="button"
                  >
                    Invite
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {!loading && projects.length === 0 && (
          <div className="mt-6 rounded-lg border border-dashed border-vscode-border p-6 text-sm text-vscode-muted">
            No projects yet. Click <span className="text-white">New Project</span> to create your first workspace.
          </div>
        )}
      </div>
    </main>
  );
}
