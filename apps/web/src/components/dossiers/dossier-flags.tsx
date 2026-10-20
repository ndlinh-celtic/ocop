import type { DossierFlag, EntityField } from "@ocop/core";
import { formatIsoDate } from "@/lib/format";

const ENTITY_FIELD_LABEL: Record<EntityField, string> = {
  name: "tên",
  taxCode: "mã số thuế",
  address: "địa chỉ",
  representativeName: "người đại diện",
  phone: "số điện thoại",
  wardId: "xã/phường đăng ký",
};

/** Story 45: what changed since the newest Phiên bản nộp, without changing the state of the hồ sơ. */
export function DossierFlags({ flags }: { flags: DossierFlag[] }) {
  return flags.map((flag) =>
    flag.kind === "legal_document_expired" ? (
      <p key={`doc-${flag.typeCode}-${flag.validUntil}`} role="status" className="mt-1 text-danger">
        {flag.typeName} trong Phiên bản nộp đã hết hiệu lực từ sau ngày {formatIsoDate(flag.validUntil)}.
      </p>
    ) : (
      <p key="entity" role="status" className="mt-1 text-amber">
        Thông tin Chủ thể đã thay đổi so với Phiên bản nộp: {flag.fields.map((f) => ENTITY_FIELD_LABEL[f]).join(", ")}.
      </p>
    ),
  );
}
