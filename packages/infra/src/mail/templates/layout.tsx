/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

const font = '"Be Vietnam Pro", Arial, sans-serif';

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="vi">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f4f7f2", fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: 24, maxWidth: 560 }}>
          <Text style={{ color: "#15803d", fontWeight: 700, fontSize: 18, margin: 0 }}>OCOP</Text>
          <Section>{children}</Section>
          <Hr />
          <Text style={{ color: "#6b7280", fontSize: 12 }}>
            Email gửi tự động từ hệ thống đánh giá, phân hạng sản phẩm OCOP. Không trả lời email này.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
