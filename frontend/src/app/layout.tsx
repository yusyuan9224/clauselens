import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClauseLens — 本地合約風險審查",
  description: "100% 本地離線的繁中合約風險審查器，你的合約不離開你的電腦",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="h-full">
      <body className="h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
