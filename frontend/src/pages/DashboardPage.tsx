import { ArrowRight, Plus, Lock, Globe } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import { CreateProjectModal } from "../components/CreateProjectModal";
import { InviteUserModal } from "../components/InviteUserModal";

interface DashboardProject {
  _id: string;
  name: string;
  description: string;
  updatedAt: string;
  role: "viewer" | "editor" | "admin";
  isPublic: boolean;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inviteProject, setInviteProject] = useState<{ id: string; name: string } | null>(null);

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


  return (
    <main className="min-h-screen bg-[#111315] px-6 py-8 text-vscode-text">
      <div className="mx-auto max-w-6xl">


        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-vscode-muted">Welcome back, {user?.username ?? "Developer"}</p>
            <h1 className="text-2xl font-bold text-white">Your Projects</h1>
          </div>
          <button
            className="rounded-md bg-vscode-blue px-4 py-2 text-sm text-white transition hover:brightness-110"
            onClick={() => setIsCreateModalOpen(true)}
            type="button"
          >
            <Plus className="mr-1 inline h-4 w-4" />
            New Project
          </button>
        </header>

        {loading && <p className="mb-4 text-sm text-vscode-muted">Loading projects...</p>}
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project._id}
              className="rounded-xl border border-vscode-border bg-vscode-panel p-4 transition hover:border-vscode-blue"
            >
              <Link className="block" to={`/project/${project._id}`}>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                  {project.isPublic ? (
                    <span title="Public Project"><Globe className="h-3.5 w-3.5 text-vscode-muted" /></span>
                  ) : (
                    <span title="Private Project"><Lock className="h-3.5 w-3.5 text-vscode-muted" /></span>
                  )}
                </div>
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
                    onClick={() => setInviteProject({ id: project._id, name: project.name })}
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
          <div className="mt-6 rounded-lg border border-dashed border-vscode-border p-6 text-sm text-vscode-muted text-center">
            No projects yet. Click <button onClick={() => setIsCreateModalOpen(true)} className="text-white hover:text-vscode-blue transition font-medium">New Project</button> to create your first workspace.
          </div>
        )}
      </div>
      {isCreateModalOpen && (
        <CreateProjectModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            loadProjects();
          }}
        />
      )}
      {inviteProject && (
        <InviteUserModal
          projectId={inviteProject.id}
          projectName={inviteProject.name}
          onClose={() => setInviteProject(null)}
        />
      )}
    </main>
  );
}
