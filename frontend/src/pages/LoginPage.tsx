import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AuthCard } from "../components/auth/AuthCard";
import { useAuth } from "../lib/auth";
import { AuthLayout } from "./AuthLayout";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    try {
      await login(values);
      const redirectTo = searchParams.get("redirect") || "/dashboard";
      navigate(redirectTo);
    } catch (error) {
      const fallback = "Unable to sign in. Please check credentials.";
      const message = error instanceof AxiosError ? error.response?.data?.message : fallback;
      setServerError(message ?? fallback);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        footerLinkHref="/register"
        footerLinkText="Create account"
        footerText="New here?"
        subtitle="Welcome back to your collaborative workspace."
        title="Sign in"
      >
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm text-vscode-muted">Email</label>
            <input
              className="w-full rounded-md border border-vscode-border bg-[#1e1e1e] px-3 py-2 text-sm outline-none focus:shadow-glow"
              placeholder="you@example.com"
              {...register("email")}
            />
            {errors.email && <p className="mt-1 text-xs text-red-400">Valid email required.</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-vscode-muted">Password</label>
            <input
              className="w-full rounded-md border border-vscode-border bg-[#1e1e1e] px-3 py-2 text-sm outline-none focus:shadow-glow"
              placeholder="••••••••"
              type="password"
              {...register("password")}
            />
            {errors.password && <p className="mt-1 text-xs text-red-400">Password must be at least 6 characters.</p>}
          </div>
          <button
            className="w-full rounded-md bg-vscode-blue px-3 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
          {serverError && <p className="text-center text-xs text-red-400">{serverError}</p>}
          <Link className="block text-center text-xs text-vscode-muted hover:text-white" to="/forgot-password">
            Forgot password?
          </Link>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
