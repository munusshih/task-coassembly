import LoginClient from "./LoginClient";

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
  const showError = params?.error === "1" || params?.error === "not-authorized";
  const showExpired = params?.expired === "1";
  const showDenied = params?.error === "not-authorized";

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Sign in">
        <div className="login-brand" aria-hidden="true">
          <span className="login-brand-text">CoA</span>
        </div>
        <h1 className="login-title">CoAssembly</h1>
        <p className="login-subtitle">Members only.</p>

        <LoginClient
          next={next}
          showError={showError}
          showExpired={showExpired}
          showDenied={showDenied}
        />
      </section>
    </main>
  );
}
