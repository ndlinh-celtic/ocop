/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface RoleGrantedProps {
  fullName: string;
  roleLabel: string;
  scopeLabel: string;
  link: string;
}

export function RoleGrantedEmail({ fullName, roleLabel, scopeLabel, link }: RoleGrantedProps) {
  return (
    <EmailLayout preview={`Bạn được phân vai ${roleLabel}`}>
      <Text>Xin chào {fullName},</Text>
      <Text>
        Quản trị hệ thống đã phân vai <b>{roleLabel}</b> cho anh/chị, phạm vi: {scopeLabel}.
      </Text>
      <Button href={link} style={{ backgroundColor: "#16a34a", color: "#ffffff", borderRadius: 8, padding: "10px 18px", fontWeight: 600 }}>
        Đăng nhập
      </Button>
    </EmailLayout>
  );
}
