import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import api from "../lib/api";
import { AuthCard } from "../components/auth/AuthCard";
import { AuthLayout } from "./AuthLayout";

const forgotSchema = z.object({ email: z.string().email() });
type ForgotValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (values: ForgotValues) => {
    setMessage(null);
    try {
      const response = await api.post("/auth/forgot-password", values);
      setMessage(response.data.message ?? "If an account exists, reset link was sent.");
    } catch (error) {
      const fallback = "Unable to send reset link right now.";
      const serverMessage = error instanceof AxiosError ? error.response?.data?.message : null;
      setMessage(serverMessage ?? fallback);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        footerLinkHref="/login"
        footerLinkText="Back to sign in"
        footerText="Remembered your password?"
        subtitle="We will send a secure reset link to your email."
        title="Forgot password"
      >
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <input
            className="w-full rounded-md border border-vscode-border bg-[#1e1e1e] px-3 py-2 text-sm outline-none focus:shadow-glow"
            placeholder="Email"
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-red-400">Please enter a valid email.</p>}
          {message && <p className="text-xs text-vscode-green">{message}</p>}
          <button
            className="w-full rounded-md bg-vscode-blue px-3 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            Send reset link
          </button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
