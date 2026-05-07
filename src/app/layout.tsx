import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GovFooter } from "@/components/shell/GovFooter";
import { GovHeader } from "@/components/shell/GovHeader";
import { getSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SISPAA Intelligent GovTech Router",
  description:
    "AI-powered autonomous government complaint orchestration platform for intelligent routing, workforce coordination, SLA monitoring, and escalation.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const role = session?.role === "ADMIN" ? "ADMIN" : session?.role === "WORKER" ? "WORKER" : "PUBLIC";
  const userLabel = session?.sub
    ? (await prisma.worker.findUnique({ where: { id: session.sub }, select: { email: true } }))?.email ?? null
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GovHeader role={role} userLabel={userLabel} />
        <main className="flex-1">{children}</main>
        <GovFooter />
      </body>
    </html>
  );
}
