import type { Metadata } from "next";
import { Geist, Geist_Mono, Libre_Caslon_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const caslon = Libre_Caslon_Display({
  variable: "--font-caslon",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lloyd — the underwriter of the agent economy",
  description:
    "Per-job delivery insurance for AI agents on OKX.AI. Priced from reputation, paid out automatically, solvency in public.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${caslon.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
