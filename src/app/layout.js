import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export const metadata = {
  title: "Co-Assembly",
  description: "Team management dashboard.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
