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
  { id: 'dashboard', title: 'Tổng quan', shortTitle: 'Tổng quan', description: 'Theo dõi tình hình kinh doanh và dữ liệu đã nhập.', group: 'TỔNG QUAN', views: ['Tình hình chung', 'Nguồn dữ liệu', 'Cảnh báo'] },
  { id: 'imports', title: 'Nhập dữ liệu', shortTitle: 'Nhập dữ liệu', description: 'Nhập Excel/CSV trên một màn hình, xem trước và xác nhận sau kiểm tra.', group: 'TỔNG QUAN', views: ['Nhập Excel', 'Lịch sử nhập'] },
  { id: 'sales-in', title: 'Sales In', shortTitle: 'Sales In', description: 'Doanh số công ty bán vào nhà phân phối theo chứng từ và kỳ.', group: 'KINH DOANH', views: ['Tổng hợp', 'Chứng từ', 'Theo SKU'] },
  { id: 'sales-out', title: 'Sales Out', shortTitle: 'Sales Out', description: 'Hàng nhà phân phối bán ra, đối chiếu nhân viên phụ trách theo ngày bán.', group: 'KINH DOANH', views: ['Tổng hợp', 'Theo nhân viên', 'Chưa xác định nhân viên', 'Chứng từ'] },
  { id: 'inventory', title: 'Xuất nhập tồn', shortTitle: 'Xuất nhập tồn', description: 'Theo dõi tồn đầu, nhập, xuất và chênh lệch tồn cuối của từng kỳ.', group: 'KINH DOANH', views: ['Theo kỳ', 'Kiểm tra chênh lệch', 'Theo SKU'] },
  { id: 'distributors', title: 'Nhà phân phối', shortTitle: 'Nhà phân phối', description: 'Danh mục nhà phân phối, hồ sơ và phạm vi tuyến bán hàng.', group: 'QUẢN TRỊ', views: ['Danh sách NPP', 'Hồ sơ', 'Tuyến bán hàng'] },
  { id: 'team', title: 'Đội ngũ kinh doanh', shortTitle: 'Đội ngũ kinh doanh', description: 'Nhân viên kinh doanh, người quản lý và lịch sử phân công theo ngày.', group: 'QUẢN TRỊ', views: ['Danh sách nhân sự', 'Sơ đồ quản lý', 'Lịch sử phân công'] },
  { id: 'targets', title: 'Chỉ tiêu & KPI', shortTitle: 'Chỉ tiêu & KPI', description: 'So sánh chỉ tiêu với kết quả trong đúng phạm vi và kỳ báo cáo.', group: 'QUẢN TRỊ', views: ['Chỉ tiêu', 'Thực hiện', 'Đối chiếu KPI'] },
  { id: 'sku', title: 'Sản phẩm & SKU', shortTitle: 'Sản phẩm & SKU', description: 'Thiết lập sản phẩm, SKU, mã NPP và bảng giá; nhập Excel và tra cứu.', group: 'QUẢN TRỊ', views: ['Thiết lập nhanh', 'Danh sách sản phẩm', 'Mã NPP & bảng giá', 'Nhập Excel', 'Phân tích SKU'] },
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
