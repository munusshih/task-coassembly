import "./globals.css";

export const metadata = {
  title: "Co-Assembly",
  description: "Team management dashboard.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
