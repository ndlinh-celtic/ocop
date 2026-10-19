import type { Metadata, Viewport } from "next";
import { themeBootScript } from "@/components/shell/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "OCOP – Đánh giá, phân hạng sản phẩm",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
