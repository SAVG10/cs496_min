import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/src/app/globals.css";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { ToastProvider } from "@/src/context/ToastContext"; // 🔥 NEW

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Helix Analytics",
  description: "Next-generation data insights",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* 🔥 GLOBAL TOAST PROVIDER */}
        <ToastProvider>

          <div className="app-container">

            {/* Sidebar */}
            <Sidebar />

            {/* Right Side */}
            <div className="main-content">

              {/* 🔥 Header (no extra wrapper) */}
              <Header />

              {/* Main Content */}
              <main className="main-inner">
                {children}
              </main>

            </div>

          </div>

        </ToastProvider>
      </body>
    </html>
  );
}