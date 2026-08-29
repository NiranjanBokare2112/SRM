"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type LoginMode = "sign-in" | "forgot" | "reset";

const genericError = "Unable to sign in. Please check your credentials and try again.";

export function LoginForm({ initialMode = "sign-in" }: { initialMode?: LoginMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setIsPending(true);

    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/admin/login?mode=reset`,
        });
        if (resetError) throw resetError;
        setMessage("If an account matches that email, recovery instructions have been sent.");
        return;
      }

      if (mode === "reset") {
        if (newPassword.length < 8) {
          setError("Your new password must be at least 8 characters long.");
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw updateError;
        setMessage("Your password has been updated. You can now sign in.");
        setPassword("");
        setNewPassword("");
        setMode("sign-in");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.replace("/admin/dashboard");
      router.refresh();
    } catch {
      setError(mode === "sign-in" ? genericError : "Unable to complete that request. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  const isSignIn = mode === "sign-in";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  return (
    <div className="admin-login-card">
      <div className="mb-8">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-light-blue)] text-[var(--brand-blue)]">
          {isReset ? <KeyRound size={21} /> : isForgot ? <Mail size={21} /> : <LockKeyhole size={21} />}
        </div>
        <p className="eyebrow">Private owner access</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--brand-dark)]">
          {isReset ? "Set a new password" : isForgot ? "Reset your password" : "Owner Login"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          {isReset
            ? "Choose a new secure password for your owner account."
            : isForgot
              ? "Enter your email and we will send secure recovery instructions."
              : "Access the Shree Ram Medical management portal."}
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {!isReset && (
          <label className="admin-field">
            <span>Email</span>
            <span className="admin-input-wrap">
              <Mail size={17} aria-hidden="true" />
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@example.com"
                autoComplete="email"
                required
              />
            </span>
          </label>
        )}

        {isSignIn && (
          <label className="admin-field">
            <span>Password</span>
            <span className="admin-input-wrap">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                type="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </span>
          </label>
        )}

        {isReset && (
          <label className="admin-field">
            <span>New password</span>
            <span className="admin-input-wrap">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                type="password"
                name="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </span>
          </label>
        )}

        {error && <p className="admin-form-error" role="alert">{error}</p>}
        {message && <p className="admin-form-message" role="status">{message}</p>}

        <button className="button button-dark w-full" type="submit" disabled={isPending}>
          {isPending ? "Please wait..." : isReset ? "Update Password" : isForgot ? "Send Recovery Email" : "Sign In"}
          {!isPending && <ArrowRight size={17} />}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        {isSignIn && (
          <button type="button" className="admin-text-button" onClick={() => { clearFeedback(); setMode("forgot"); }}>
            Forgot password?
          </button>
        )}
        {(isForgot || isReset) && (
          <button type="button" className="admin-text-button" onClick={() => { clearFeedback(); setMode("sign-in"); }}>
            Back to Owner Login
          </button>
        )}
      </div>
    </div>
  );
}
