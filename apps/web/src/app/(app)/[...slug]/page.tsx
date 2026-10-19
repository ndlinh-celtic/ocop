import { Construction } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ALL_NAV_ITEMS } from "@/lib/nav";

/** Menu entries whose module arrives in a later step render an empty state instead of a 404. */
export default async function UpcomingPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const item = ALL_NAV_ITEMS.find((i) => !i.ready && i.href === `/${slug.join("/")}`);
  if (!item) notFound();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{item.label}</h1>
      <EmptyState icon={Construction} title="Chức năng đang được xây dựng">
        Mục này thuộc các bước sau của dự án và chưa có dữ liệu.
      </EmptyState>
    </div>
  );
}
