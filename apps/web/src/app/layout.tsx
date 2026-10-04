import type { CSSProperties, ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Fraunces, JetBrains_Mono, Noto_Sans_Ethiopic } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import { LOOK_COOKIE, RESTORE_LOOK_SCRIPT, lookHtmlAttrs, parseStoredLook } from "@/lib/theme";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Atkinson_Hyperlegible({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const ethiopic = Noto_Sans_Ethiopic({
  variable: "--font-ethiopic",
  subsets: ["ethiopic"],
  weight: ["400", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MatricPrep",
  description: "Ethiopian matric exam preparation — track and subject practice, past papers, timed mocks, Duel rooms, and Pro coaching.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#07080c",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const look = parseStoredLook((await cookies()).get(LOOK_COOKIE)?.value);
  const attrs = lookHtmlAttrs(look);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={attrs["data-theme"]}
      data-accent={attrs["data-accent"]}
      style={attrs.style as CSSProperties | undefined}
      className={`${display.variable} ${body.variable} ${ethiopic.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <Script
          id="restore-look"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: RESTORE_LOOK_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-ink">{children}</body>
    </html>
  );
}
