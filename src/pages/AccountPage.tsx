import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  changePassword,
  deleteAccount,
  login,
  logout,
  register,
} from "../lib/auth";
import { ClientApiError } from "../lib/api";
import { readPendingRun, submitPendingRun } from "../lib/run-api";
import { usePageMeta } from "../lib/page-meta";
import { useSession } from "../lib/session-context";

type Mode = "login" | "register";

export function AccountPage() {
  usePageMeta(
    "Account",
    "Create an account to save verified Snake scores.",
    true,
  );
  const { loading, setUser, user } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasPendingRun] = useState(() => readPendingRun() !== null);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") || "");
    const password = String(data.get("password") || "");
    if (
      mode === "register" &&
      password !== String(data.get("confirmPassword") || "")
    ) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result =
        mode === "register"
          ? await register(username, password)
          : await login(username, password);
      setUser(result.user);
      setNotice(mode === "register" ? "Account created." : "Signed in.");
      try {
        const savedScore = await submitPendingRun();
        if (savedScore !== null)
          setNotice(`Signed in. Score ${savedScore} is now on your account.`);
      } catch {
        setNotice(
          "Signed in. Your saved score is still waiting; return to the game to retry it.",
        );
      }
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") || "");
    if (newPassword !== String(data.get("confirmNewPassword") || "")) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await changePassword(
        String(data.get("currentPassword") || ""),
        newPassword,
      );
      form.reset();
      setNotice("Password changed. Other signed-in sessions were closed.");
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (String(data.get("confirmation") || "") !== user?.username) {
      setError("Type your exact username to confirm deletion.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await deleteAccount(String(data.get("password") || ""));
      setUser(null);
      setNotice("Your account and published scores were deleted.");
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <section className="account-page">
        <p className="account-loading">Checking your session…</p>
      </section>
    );

  if (!user) {
    return (
      <section className="account-page">
        <div className="account-intro">
          <h1>{hasPendingRun ? "Save your score." : mode === "login" ? "Sign in." : "Create an account."}</h1>
          <p>
            {hasPendingRun
              ? "Sign in or create an account to publish your score."
              : "Anyone can play. Create an account only to save verified scores and appear on the leaderboard."}
          </p>
        </div>
        <div className="auth-panel">
          <div className="auth-switch" aria-label="Account action">
            <button
              className={mode === "login" ? "active" : ""}
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Sign in
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Create account
            </button>
          </div>
          <form key={mode} onSubmit={handleAuth}>
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                spellCheck={false}
                minLength={3}
                maxLength={20}
                required
              />
            </label>
            <PasswordInput
              name="password"
              label="Password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              minLength={mode === "register" ? 15 : 1}
              required
            />
            {mode === "register" ? (
              <>
                <PasswordInput
                  name="confirmPassword"
                  label="Confirm password"
                  autoComplete="new-password"
                  minLength={15}
                  required
                />
                <p className="form-help">
                  Use at least 15 characters. With no email on file, forgotten passwords
                  cannot be reset.
                </p>
                <label className="consent-check">
                  <input name="publicConsent" type="checkbox" required />
                  <span>
                    I understand my username and saved scores will be public.
                    I’ve read the <Link to="/privacy">privacy notice</Link>.
                  </span>
                </label>
                <p className="form-help">
                  Creating an account means you agree to the <Link to="/terms">terms of use</Link>.
                </p>
              </>
            ) : null}
            {error ? (
              <p className="form-message form-message--error" role="alert">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="form-message form-message--success" role="status">
                {notice}
              </p>
            ) : null}
            <button className="primary-action" type="submit" disabled={busy}>
              {busy
                ? "Working…"
                : mode === "register"
                  ? hasPendingRun ? "Create and save score" : "Create account"
                  : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="account-page account-page--signed-in">
      <div className="account-intro">
        <h1>Hey, {user.username}.</h1>
        <p>
          Your username and saved best score are public. You can manage your
          account here.
        </p>
        <button
          className="text-action"
          type="button"
          onClick={async () => {
            setError("");
            try {
              await logout();
              setUser(null);
            } catch (caught) {
              setError(messageFrom(caught));
            }
          }}
        >
          Sign out
        </button>
      </div>
      <div className="account-settings">
        {notice ? (
          <p className="form-message form-message--success" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        ) : null}
        <form onSubmit={handlePassword}>
          <h2>Change password</h2>
          <PasswordInput
            name="currentPassword"
            label="Current password"
            autoComplete="current-password"
            required
          />
          <PasswordInput
            name="newPassword"
            label="New password"
            autoComplete="new-password"
            minLength={15}
            required
          />
          <PasswordInput
            name="confirmNewPassword"
            label="Confirm new password"
            autoComplete="new-password"
            minLength={15}
            required
          />
          <button type="submit" disabled={busy}>
            Update password
          </button>
        </form>
        <form className="danger-zone" onSubmit={handleDelete}>
          <h2>Delete account</h2>
          <p>This permanently removes the account and all published scores.</p>
          <PasswordInput
            name="password"
            label="Password"
            autoComplete="current-password"
            required
          />
          <label>
            Type “{user.username}”
            <input
              name="confirmation"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Delete permanently
          </button>
        </form>
      </div>
    </section>
  );
}

function PasswordInput({
  name,
  label,
  autoComplete,
  minLength = 1,
  required,
}: {
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div className="password-input">
      <label htmlFor={id}>{label}</label>
      <span className="password-field">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={128}
          required={required}
        />
        <button
          className="password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </div>
  );
}

function messageFrom(error: unknown): string {
  return error instanceof ClientApiError
    ? error.message
    : "Could not reach the server. Try again.";
}
