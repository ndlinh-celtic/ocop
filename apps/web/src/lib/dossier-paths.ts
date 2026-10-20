/**
 * Where the pages of a Chủ thể's hồ sơ live: its own (S12 to S16), or, under Nhập hộ (L01), the same
 * pages inside the Cán bộ xã's view of that Chủ thể.
 */
export const dossierHome = (onBehalf?: string) => (onBehalf ? `/xa/chu-the/${onBehalf}/ho-so` : "/chu-the/ho-so");
