import { Link, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export function AccountLockedEmail({ fullName, untilText, resetLink }: { fullName: string; untilText: string; resetLink: string }) {
  return (
    <EmailLayout preview="Tài khoản OCOP bị tạm khóa">
      <Text>Xin chào {fullName},</Text>
      <Text>Tài khoản của anh/chị bị tạm khóa đến {untilText} vì nhập sai mật khẩu hoặc mã xác thực nhiều lần.</Text>
      <Text>
        Nếu không phải anh/chị thực hiện, hãy <Link href={resetLink}>đặt lại mật khẩu</Link> sau khi hết thời gian khóa và báo cho Quản trị hệ
        thống.
      </Text>
    </EmailLayout>
  );
}
