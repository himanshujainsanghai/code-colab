import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import api from "../lib/api";
import { AuthCard } from "../components/auth/AuthCard";
import { AuthLayout } from "./AuthLayout";

const resetSchema = z
  .object({
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  });

type ResetValues = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  const onSubmit = async (values: ResetValues) => {
    setServerError(null);
    setSuccessMessage(null);
    const token = searchParams.get("token");
    if (!token) {
      setServerError("Reset token is missing.");
      return;
    }
    try {
      await api.post("/auth/reset-password", {
        token,
        password: values.password,
      });
      setSuccessMessage("Password reset successful. Redirecting to sign in...");
      setTimeout(() => navigate("/login"), 1000);
    } catch (error) {
      const fallback = "Unable to reset password.";
      const message = error instanceof AxiosError ? error.response?.data?.message : fallback;
      setServerError(message ?? fallback);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        footerLinkHref="/login"
        footerLinkText="Sign in"
        footerText="Done resetting?"
        subtitle="Choose a strong new password."
        title="Reset password"
      >
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <input
            className="w-full rounded-md border border-vscode-border bg-[#1e1e1e] px-3 py-2 text-sm outline-none focus:shadow-glow"
            placeholder="New password"
            type="password"
            {...register("password")}
          />
          <input
            className="w-full rounded-md border border-vscode-border bg-[#1e1e1e] px-3 py-2 text-sm outline-none focus:shadow-glow"
            placeholder="Confirm password"
            type="password"
            {...register("confirmPassword")}
          />
          {(errors.password || errors.confirmPassword) && (
            <p className="text-xs text-red-400">Password must be 6+ chars and match.</p>
          )}
          {serverError && <p className="text-xs text-red-400">{serverError}</p>}
          {successMessage && <p className="text-xs text-vscode-green">{successMessage}</p>}
          <button
            className="w-full rounded-md bg-vscode-blue px-3 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            Reset password
          </button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
