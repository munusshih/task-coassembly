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

  return (
    <main className="login-page">
      <section className="login-card">
        <h1 className="login-title">Dashboard Login</h1>
        <p className="login-subtitle">Enter password to continue.</p>

        <form method="post" action="/api/auth/login" className="login-form">
          <input type="hidden" name="next" value={next} />

          <label className="login-field-label" htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            className="login-input"
            defaultValue="dashboard"
            required
          />

          <label className="login-field-label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="login-input"
            placeholder="Password"
            required
          />

          {showError && <p className="login-error">Incorrect password. Try again.</p>}

          <button type="submit" className="login-submit">Enter Dashboard</button>
        </form>
      </section>
    </main>
  );
}
