import type { ValidationIssue } from "@ocop/core";
import { CircleAlert, CircleCheck } from "lucide-react";
import Link from "next/link";

/**
 * L19 AD-04: every problem of the draft at once, each with its Bộ tiêu chí and mã tiêu chí.
 * `scope` "set" is the page of one Bộ tiêu chí, given only its own problems and the version-wide ones.
 */
export function ValidationIssues({ versionId, issues, scope = "version" }: { versionId: string; issues: ValidationIssue[]; scope?: "version" | "set" }) {
  if (issues.length === 0) {
    return (
      <section role="status" className="flex items-center gap-2 rounded-lg border border-brand bg-brand-soft p-4 text-sm">
        <CircleCheck className="size-5 shrink-0 text-brand" aria-hidden />
        {scope === "set" ? "Kiểm tra không thấy lỗi trong bộ tiêu chí này." : "Kiểm tra không thấy lỗi. Bản nháp sẵn sàng phát hành."}
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-danger bg-surface" aria-labelledby="validation-title">
      <h2 id="validation-title" className="flex items-center gap-2 border-b px-4 py-3 font-medium text-danger">
        <CircleAlert className="size-5 shrink-0" aria-hidden />
        {issues.length} lỗi kiểm tra{scope === "set" ? " trong bộ tiêu chí này" : ""}; sửa hết trước khi phát hành
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface-2">
            <tr>
              <th className="px-4 py-2">Bộ tiêu chí</th>
              <th className="px-4 py-2">Mã tiêu chí</th>
              <th className="px-4 py-2">Lỗi</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2 whitespace-nowrap">
                  {issue.setId ? (
                    <Link href={`/quan-tri/bo-tieu-chi/${versionId}/bo/${issue.setId}`} className="text-brand underline-offset-2 hover:underline">
                      Bộ {issue.setCode}
                    </Link>
                  ) : (
                    <span className="text-text-3">Toàn phiên bản</span>
                  )}
                </td>
                <td className="px-4 py-2">{issue.criterionCode ?? ""}</td>
                <td className="px-4 py-2">{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
