import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

/**
 * A page that does not exist, or a record outside the Phạm vi of the Vai trò đang dùng: both read the
 * same, so the page does not reveal that the record exists.
 */
export default function NotFound() {
  return (
    <EmptyState icon={SearchX} title="Không tìm thấy trang">
      Trang không tồn tại hoặc bạn không có quyền xem.{" "}
      <Link href="/" className="text-brand underline-offset-2 hover:underline">
        Về trang chủ
      </Link>
    </EmptyState>
  );
}
