import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AuthCard } from "../components/auth/AuthCard";
import { useAuth } from "../lib/auth";
import { AuthLayout } from "./AuthLayout";

const registerSchema = z
  .object({
    username: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register: registerUser } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterValues) => {
    setServerError(null);
    try {
      await registerUser({
        username: values.username,
        email: values.email,
        password: values.password,
      });
      const redirectTo = searchParams.get("redirect") || "/dashboard";
      navigate(redirectTo);
    } catch (error) {
      const fallback = "Unable to create account.";
      const message = error instanceof AxiosError ? error.response?.data?.message : fallback;
      setServerError(message ?? fallback);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        footerLinkHref="/login"
        footerLinkText="Sign in"
        footerText="Already registered?"
        subtitle="Create your workspace and invite collaborators."
        title="Create account"
      >
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <input
            className="w-full rounded-md border border-vscode-border bg-[#1e1e1e] px-3 py-2 text-sm outline-none focus:shadow-glow"
            placeholder="Username"
            {...register("username")}
          />
          <input
            className="w-full rounded-md border border-vscode-border bg-[#1e1e1e] px-3 py-2 text-sm outline-none focus:shadow-glow"
            placeholder="Email"
            {...register("email")}
          />
          <input
            className="w-full rounded-md border border-vscode-border bg-[#1e1e1e] px-3 py-2 text-sm outline-none focus:shadow-glow"
            placeholder="Password"
            type="password"
            {...register("password")}
          />
          <input
            className="w-full rounded-md border border-vscode-border bg-[#1e1e1e] px-3 py-2 text-sm outline-none focus:shadow-glow"
            placeholder="Confirm password"
            type="password"
            {...register("confirmPassword")}
          />
          {(errors.username || errors.email || errors.password || errors.confirmPassword) && (
            <p className="text-xs text-red-400">Please fill all fields correctly.</p>
          )}
          <button
            className="w-full rounded-md bg-vscode-blue px-3 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Creating..." : "Create account"}
          </button>
          {serverError && <p className="text-center text-xs text-red-400">{serverError}</p>}
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
