/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface DossierNoticeProps {
  fullName: string;
  subject: string;
  line: string;
  link: string;
}

/** A notice about a hồ sơ: one fixed line and a link, never the content of the hồ sơ. */
export function DossierNoticeEmail({ fullName, subject, line, link }: DossierNoticeProps) {
  return (
    <EmailLayout preview={subject}>
      <Text>Xin chào {fullName},</Text>
      <Text>{line}</Text>
      <Button href={link} style={{ backgroundColor: "#16a34a", color: "#ffffff", borderRadius: 8, padding: "10px 18px", fontWeight: 600 }}>
        Xem hồ sơ
      </Button>
      <Text style={{ color: "#6b7280", fontSize: 12 }}>Hoặc mở đường dẫn: {link}</Text>
    </EmailLayout>
  );
}
