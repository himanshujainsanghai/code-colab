import { AxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import api from "../lib/api";

interface ValidatedInvitation {
  token: string;
  role: "viewer" | "editor" | "admin";
  invitedEmail: string;
  expiresAt: string;
  project: { id: string; name: string } | null;
  invitedBy: { id: string; username: string } | null;
}

export function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<ValidatedInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setError("Invitation token is missing.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await api.get("/invitations/validate", {
          params: { token },
        });
        const payload = response.data.data as { valid: boolean; invitation?: ValidatedInvitation };
        if (!payload.valid || !payload.invitation) {
          setError("This invitation is invalid or expired.");
          setInvitation(null);
        } else {
          setInvitation(payload.invitation);
        }
      } catch {
        setError("Could not validate invitation.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [token]);

  const acceptInvitation = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      const response = await api.post("/invitations/accept", { token });
      const projectId = response.data.data.projectId as string;
      navigate(`/project/${projectId}`);
    } catch (unknownError) {
      const message =
        unknownError instanceof AxiosError
          ? (unknownError.response?.data?.message as string | undefined)
          : undefined;
      setError(message ?? "Could not accept invitation.");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111315] text-vscode-muted">
        Validating invitation...
      </main>
    );
  }

  if (!invitation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111315] px-4">
        <div className="w-full max-w-lg rounded-xl border border-vscode-border bg-vscode-panel p-6 text-vscode-text">
          <h1 className="text-xl font-semibold text-white">Invitation not available</h1>
          <p className="mt-2 text-sm text-vscode-muted">{error ?? "The invitation cannot be used."}</p>
          <Link className="mt-5 inline-block text-sm text-vscode-blue hover:underline" to="/dashboard">
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const emailMatches = user?.email?.toLowerCase() === invitation.invitedEmail.toLowerCase();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111315] px-4">
      <div className="w-full max-w-xl rounded-xl border border-vscode-border bg-vscode-panel p-6 text-vscode-text">
        <h1 className="text-2xl font-semibold text-white">Project invitation</h1>
        <p className="mt-2 text-sm text-vscode-muted">
          <span className="text-white">{invitation.invitedBy?.username ?? "A collaborator"}</span> invited you to join{" "}
          <span className="text-white">{invitation.project?.name ?? "a project"}</span> as{" "}
          <span className="uppercase text-vscode-blue">{invitation.role}</span>.
        </p>
        <p className="mt-1 text-xs text-vscode-muted">Invited email: {invitation.invitedEmail}</p>
        <p className="mt-1 text-xs text-vscode-muted">
          Expires: {new Date(invitation.expiresAt).toLocaleString()}
        </p>

        {!isAuthenticated ? (
          <div className="mt-6 flex items-center gap-3">
            <Link
              className="rounded-md bg-vscode-blue px-4 py-2 text-sm text-white"
              to={`/login?redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`}
            >
              Sign In to Accept
            </Link>
            <Link
              className="rounded-md border border-vscode-border px-4 py-2 text-sm text-vscode-muted hover:text-white"
              to={`/register?redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`}
            >
              Register
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            {!emailMatches && (
              <p className="mb-3 text-xs text-yellow-300">
                You are signed in as {user?.email}. This invitation is for {invitation.invitedEmail}.
              </p>
            )}
            <button
              className="rounded-md bg-vscode-blue px-4 py-2 text-sm text-white disabled:opacity-60"
              disabled={accepting}
              onClick={() => void acceptInvitation()}
              type="button"
            >
              {accepting ? "Accepting..." : "Accept Invitation"}
            </button>
          </div>
        )}

        {error && <p className="mt-4 text-xs text-red-400">{error}</p>}
      </div>
    </main>
  );
}
