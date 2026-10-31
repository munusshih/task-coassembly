import LoginClient from "./LoginClient";
import ProtocolLogo from "../components/ui/ProtocolLogo";
import styles from "./LoginPage.module.css";

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
    <main className={`${styles.page} login-page`}>
      <section className={`${styles.card} login-card`} aria-label="Sign in">
        <ProtocolLogo className={`${styles.brand} login-brand`} />
        <h1 className="login-title">A workspace for worker-owners</h1>

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
