import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "거래내역 대시보드",
  description: "신한투자증권 해외주식 거래내역 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
