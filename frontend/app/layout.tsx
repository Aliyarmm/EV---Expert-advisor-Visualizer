import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { OnboardingWrapper } from "@/components/onboarding-wrapper";
import { KeyboardNav } from "@/components/keyboard-nav";

export const metadata: Metadata = {
  title: "EA Index — Trading Research Platform",
  description: "Strategy library, backtesting, and portfolio construction for algorithmic traders",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans bg-bg text-text transition-colors duration-300">
        <ThemeProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <TopBar />
              <main className="flex-1 overflow-y-auto">
                <Suspense fallback={null}>
                  <OnboardingWrapper />
                </Suspense>
                <KeyboardNav />
                {children}
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
