import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OCOP – Đánh giá, phân hạng sản phẩm",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
