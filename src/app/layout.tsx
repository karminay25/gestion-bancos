import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistema Bancario LBO",
  description: "Gestión financiera para Lola, Bosbes y Oba",
};

import { SidebarProvider, useSidebar } from "@/context/SidebarContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 dark:bg-zinc-950">
        <SidebarProvider>
          <div className="flex h-screen overflow-hidden">
            <SidebarPrv />
            <main className="flex-1 overflow-y-auto p-8 relative">
              {children}
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}

function SidebarPrv() {
    return <Sidebar />;
}
