/** Navigation vocabulary only. No business records or values are synthesized by the UI. */
export type PageId = 'dashboard' | 'imports' | 'sales-in' | 'sales-out' | 'inventory' | 'distributors' | 'team' | 'targets' | 'sku' | 'reports';

export interface BusinessPage {
  id: PageId;
  title: string;
  shortTitle: string;
  description: string;
  group: 'TỔNG QUAN' | 'KINH DOANH' | 'QUẢN TRỊ';
  views: readonly string[];
}

export const businessPages: readonly BusinessPage[] = [
  { id: 'dashboard', title: 'Tổng quan', shortTitle: 'Tổng quan', description: 'Theo dõi sức khỏe dữ liệu và tình hình kinh doanh theo phạm vi được cấu hình.', group: 'TỔNG QUAN', views: ['Tình hình chung', 'Nguồn dữ liệu', 'Cảnh báo'] },
  { id: 'imports', title: 'Dữ liệu & Import', shortTitle: 'Dữ liệu & Import', description: 'Quản lý lô dữ liệu đầu vào, ánh xạ cột và những dòng cần đối soát.', group: 'TỔNG QUAN', views: ['Lô nhập', 'Ánh xạ cột', 'Lỗi dữ liệu'] },
  { id: 'sales-in', title: 'Sales In', shortTitle: 'Sales In', description: 'Doanh số công ty bán vào nhà phân phối theo chứng từ và kỳ.', group: 'KINH DOANH', views: ['Tổng hợp', 'Chứng từ', 'Theo SKU'] },
  { id: 'sales-out', title: 'Sales Out', shortTitle: 'Sales Out', description: 'Hàng nhà phân phối bán ra, đối chiếu nhân viên phụ trách theo ngày bán.', group: 'KINH DOANH', views: ['Tổng hợp', 'Theo nhân viên', 'Chưa gán', 'Chứng từ'] },
  { id: 'inventory', title: 'Xuất nhập tồn', shortTitle: 'Xuất nhập tồn', description: 'Theo dõi tồn đầu, nhập, xuất và chênh lệch tồn cuối của từng kỳ.', group: 'KINH DOANH', views: ['Theo kỳ', 'Đối chiếu tồn', 'Theo SKU'] },
  { id: 'distributors', title: 'Nhà phân phối', shortTitle: 'Nhà phân phối', description: 'Danh mục nhà phân phối, hồ sơ và phạm vi tuyến bán hàng.', group: 'QUẢN TRỊ', views: ['Danh sách NPP', 'Hồ sơ', 'Tuyến bán hàng'] },
  { id: 'team', title: 'Đội ngũ kinh doanh', shortTitle: 'Đội ngũ kinh doanh', description: 'Cấu trúc SALES / SUP / ASM cùng lịch sử phân công hiệu lực.', group: 'QUẢN TRỊ', views: ['Danh sách nhân sự', 'Cây quản lý', 'Lịch sử phân công'] },
  { id: 'targets', title: 'Chỉ tiêu & KPI', shortTitle: 'Chỉ tiêu & KPI', description: 'So sánh chỉ tiêu với kết quả trong đúng phạm vi và kỳ báo cáo.', group: 'QUẢN TRỊ', views: ['Chỉ tiêu', 'Thực hiện', 'Đối chiếu KPI'] },
  { id: 'sku', title: 'Phân tích SKU', shortTitle: 'Phân tích SKU', description: 'Phân tích cơ cấu sản phẩm, đóng góp và biến động theo nhà phân phối.', group: 'QUẢN TRỊ', views: ['Theo SKU', 'Theo nhà phân phối', 'Xu hướng', 'Danh mục sản phẩm'] },
  { id: 'reports', title: 'Báo cáo', shortTitle: 'Báo cáo', description: 'Tập hợp các loại báo cáo, lịch sử xuất và trạng thái nguồn.', group: 'QUẢN TRỊ', views: ['Danh mục báo cáo', 'Lịch sử xuất', 'Nguồn dữ liệu'] },
];

export const businessGroups = ['TỔNG QUAN', 'KINH DOANH', 'QUẢN TRỊ'] as const;

export function getPage(id: PageId): BusinessPage {
  return businessPages.find((item) => item.id === id) ?? businessPages[0];
}

export function getDefaultView(id: PageId): string {
  return getPage(id).views[0];
}

export function getValidView(id: PageId, candidate: string): string {
  const page = getPage(id);
  return page.views.includes(candidate) ? candidate : page.views[0];
}
