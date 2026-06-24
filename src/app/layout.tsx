import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { DashboardProvider } from "@/context/DashboardContext";

export const metadata: Metadata = {
  title: "영차영차 주식 거래일지",
  description: "영차영차 주식 거래일지",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <DashboardProvider>
          {children}
          <BottomNav />
        </DashboardProvider>
      </body>
    </html>
  );
}
