import Link from "next/link";

/** An address outside the signed-in pages that does not exist. */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface-2 p-4">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-lg bg-surface p-8 text-center shadow-card">
        <h1 className="text-lg font-semibold">Không tìm thấy trang</h1>
        <p className="text-sm text-text-2">Trang không tồn tại hoặc bạn không có quyền xem.</p>
        <Link href="/" className="text-sm text-brand">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
