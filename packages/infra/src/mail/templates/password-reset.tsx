/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export function PasswordResetEmail({ fullName, link, expiresAtText }: { fullName: string; link: string; expiresAtText: string }) {
  return (
    <EmailLayout preview="Đặt lại mật khẩu OCOP">
      <Text>Xin chào {fullName},</Text>
      <Text>Có yêu cầu đặt lại mật khẩu cho tài khoản của anh/chị. Bấm nút dưới đây để đặt mật khẩu mới.</Text>
      <Button href={link} style={{ backgroundColor: "#16a34a", color: "#ffffff", borderRadius: 8, padding: "10px 18px", fontWeight: 600 }}>
        Đặt lại mật khẩu
      </Button>
      <Text>Hoặc mở liên kết: {link}</Text>
      <Text>Liên kết dùng một lần và hết hạn lúc {expiresAtText}. Nếu anh/chị không yêu cầu, hãy bỏ qua email này.</Text>
    </EmailLayout>
  );
}
