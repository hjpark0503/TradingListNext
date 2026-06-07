import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "영차영차 주식 거래일지",
  description: "영차영차 주식 거래일지",
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
