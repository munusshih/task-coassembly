function safeNext(nextParam) {
  if (!nextParam || typeof nextParam !== "string") return "/";
  if (!nextParam.startsWith("/")) return "/";
  if (nextParam.startsWith("//")) return "/";
  return nextParam;
}

export const metadata = {
  title: "Dashboard Login",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = safeNext(params?.next || "/");
  const showError = params?.error === "1";
  const showExpired = params?.expired === "1";

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Sign in">
        <p className="login-kicker">CoAssembly</p>
        <h1 className="login-title">Welcome Back</h1>
        <p className="login-subtitle">
          Sign in to continue to your workspace dashboard.
        </p>

        <form method="post" action="/api/auth/login" className="login-form">
          <input type="hidden" name="next" value={next} />

          <label className="login-field-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            className="login-input"
            placeholder="Enter your username"
            required
          />

          <label className="login-field-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="login-input"
            placeholder="Password"
            required
          />

          {showError && (
            <p className="login-error">
              Incorrect username or password. Try again.
            </p>
          )}
          {showExpired && (
            <p className="login-error login-error--expired">
              Session has expired. Please sign in again.
            </p>
          )}

          <button type="submit" className="login-submit">
            Enter Dashboard
          </button>
        </form>

        <p className="login-help">Use your assigned account credentials.</p>
      </section>
    </main>
  );
}
