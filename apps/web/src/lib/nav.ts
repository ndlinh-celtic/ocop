import type { Role } from "@ocop/core";
import {
  Award,
  Bell,
  CalendarRange,
  ChartColumn,
  CircleUser,
  ClipboardList,
  Copy,
  FileBadge,
  FileText,
  FolderOpen,
  GitFork,
  House,
  Inbox,
  Library,
  ListChecks,
  ListTree,
  Lock,
  ScrollText,
  Send,
  Star,
  Table2,
  Upload,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** False: the module arrives in a later step; the page shows an empty state. */
  ready: boolean;
}

const HOME: NavItem = { href: "/", label: "Trang chủ", icon: House, ready: true };
const COMMON: NavItem[] = [
  { href: "/thong-bao", label: "Thông báo", icon: Bell, ready: true },
  { href: "/tai-khoan", label: "Thông tin cá nhân", icon: CircleUser, ready: true },
];
const STATS: NavItem = { href: "/thong-ke", label: "Thống kê", icon: ChartColumn, ready: false };

/** Menu per Vai trò, following the prototype (design/prototype/src/core.js, O.MENUS). */
export const NAV: Record<Role, NavItem[]> = {
  entity_owner: [
    HOME,
    { href: "/chu-the/ho-so", label: "Hồ sơ của tôi", icon: FolderOpen, ready: false },
    { href: "/chu-the/phap-ly", label: "Hồ sơ pháp lý", icon: FileBadge, ready: false },
    ...COMMON,
  ],
  ward_officer: [
    HOME,
    { href: "/xa/ho-so", label: "Hồ sơ tại xã", icon: FolderOpen, ready: false },
    { href: "/xa/gui-len-tinh", label: "Gửi lên tỉnh", icon: Send, ready: false },
    STATS,
    ...COMMON,
  ],
  province_officer: [
    HOME,
    { href: "/so/dot-danh-gia", label: "Đợt đánh giá", icon: CalendarRange, ready: false },
    { href: "/so/ho-so", label: "Hồ sơ toàn tỉnh", icon: FolderOpen, ready: false },
    { href: "/so/ho-so-5-sao", label: "Hồ sơ 5 sao", icon: Star, ready: false },
    STATS,
    ...COMMON,
  ],
  council_chair: [
    HOME,
    { href: "/hoi-dong", label: "Hội đồng", icon: Users, ready: false },
    { href: "/hoi-dong/tien-do", label: "Tiến độ chấm", icon: ListChecks, ready: false },
    { href: "/hoi-dong/van-ban", label: "Văn bản", icon: FileText, ready: false },
    ...COMMON,
  ],
  council_secretary: [
    HOME,
    { href: "/hoi-dong", label: "Hội đồng", icon: Users, ready: false },
    { href: "/hoi-dong/phan-cong", label: "Phân công", icon: GitFork, ready: false },
    { href: "/hoi-dong/tien-do", label: "Tiến độ chấm", icon: ListChecks, ready: false },
    { href: "/hoi-dong/chot-diem", label: "Chốt điểm", icon: Lock, ready: false },
    { href: "/hoi-dong/van-ban", label: "Văn bản", icon: FileText, ready: false },
    { href: "/hoi-dong/chung-nhan", label: "Chứng nhận", icon: Award, ready: false },
    ...COMMON,
  ],
  council_member: [
    HOME,
    { href: "/thanh-vien/ho-so", label: "Hồ sơ được phân công", icon: ClipboardList, ready: false },
    { href: "/thanh-vien/diem-tong-hop", label: "Điểm tổng hợp", icon: Table2, ready: false },
    ...COMMON,
  ],
  advisory_member: [
    HOME,
    { href: "/to-tu-van/hang-doi", label: "Hàng đợi thẩm định", icon: Inbox, ready: false },
    { href: "/to-tu-van/sao-chep", label: "Sao chép sang phiếu chấm", icon: Copy, ready: false },
    ...COMMON,
  ],
  admin: [
    HOME,
    { href: "/quan-tri/nguoi-dung", label: "Người dùng và phân vai", icon: UsersRound, ready: true },
    { href: "/quan-tri/bo-tieu-chi", label: "Bộ tiêu chí", icon: ListTree, ready: false },
    { href: "/quan-tri/danh-muc", label: "Danh mục", icon: Library, ready: false },
    { href: "/quan-tri/nhat-ky", label: "Nhật ký", icon: ScrollText, ready: true },
    { href: "/quan-tri/thu-tai-tep", label: "Thử tải tệp", icon: Upload, ready: true },
    ...COMMON,
  ],
};

/** Without a Vai trò đang dùng only the personal pages are reachable. */
export const NAV_NO_ROLE: NavItem[] = [HOME, ...COMMON];

export const navFor = (role: Role | null) => (role ? NAV[role] : NAV_NO_ROLE);

export const ALL_NAV_ITEMS = [...new Map(Object.values(NAV).flat().map((i) => [i.href, i])).values()];

/** The menu item a path belongs to: the longest matching prefix. */
export function matchNav(items: NavItem[], pathname: string): NavItem | undefined {
  return items
    .filter((i) => (i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
