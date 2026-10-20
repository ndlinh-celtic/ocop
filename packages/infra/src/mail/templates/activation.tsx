/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface ActivationProps {
  fullName: string;
  link: string;
  expiresAtText: string;
}

export function ActivationEmail({ fullName, link, expiresAtText }: ActivationProps) {
  return (
    <EmailLayout preview="Kích hoạt tài khoản OCOP">
      <Text>Xin chào {fullName},</Text>
      <Text>Quản trị hệ thống đã tạo tài khoản cho anh/chị. Bấm nút dưới đây để đặt mật khẩu và kích hoạt tài khoản.</Text>
      <Button href={link} style={{ backgroundColor: "#16a34a", color: "#ffffff", borderRadius: 8, padding: "10px 18px", fontWeight: 600 }}>
        Kích hoạt tài khoản
      </Button>
      <Text>Hoặc mở liên kết: {link}</Text>
      <Text>Liên kết chỉ dùng được một lần và hết hạn lúc {expiresAtText}.</Text>
    </EmailLayout>
  );
}
