import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const sentient = localFont({
  src: "../assets/fonts/Sentient-Variable.ttf",
  variable: "--font-sentient",
  display: "swap",
  weight: "100 900",
});

const sponact = localFont({
  src: "../assets/fonts/sponact015001-Regular (1).otf",
  variable: "--font-sponact",
  display: "swap",
});

export const metadata = {
  title: "CoAssembly Task",
  description: "Team management dashboard.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sentient.variable} ${sponact.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
