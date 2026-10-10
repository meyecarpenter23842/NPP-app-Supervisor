import { useState } from 'react';
import { Badge, Button, Card, Text, Title2, Title3 } from '@fluentui/react-components';
import OperatorForm from './OperatorForm';
import type { LocalOperator, OperatorInput } from '../ipc';

type PageId = 'dashboard' | 'imports' | 'sales-in' | 'sales-out' | 'inventory' | 'distributors' | 'team' | 'targets' | 'sku' | 'reports' | 'settings';
type Page = { id: PageId; title: string; description: string };
type Group = { title: string; pages: Page[] };

const groups: Group[] = [
  { title: 'TỔNG QUAN', pages: [
    { id: 'dashboard', title: 'Tổng quan', description: 'Tình hình kinh doanh và chỉ số theo kỳ' },
    { id: 'imports', title: 'Dữ liệu & Import', description: 'Nhập và kiểm tra dữ liệu từ Excel/CSV' },
  ] },
  { title: 'KINH DOANH', pages: [
    { id: 'sales-in', title: 'Sales In', description: 'Doanh số công ty bán vào nhà phân phối' },
    { id: 'sales-out', title: 'Sales Out', description: 'Doanh số nhà phân phối bán ra' },
    { id: 'inventory', title: 'Xuất nhập tồn', description: 'Đối chiếu số liệu XNT và ngày tồn' },
    { id: 'distributors', title: 'Nhà phân phối', description: 'Quản lý danh mục NPP' },
    { id: 'team', title: 'Đội ngũ kinh doanh', description: 'Nhân sự và quan hệ quản lý theo thời gian' },
    { id: 'targets', title: 'Chỉ tiêu & KPI', description: 'Kết quả thực hiện so với chỉ tiêu' },
    { id: 'sku', title: 'Phân tích SKU', description: 'Phân tích sản phẩm theo nhà phân phối' },
    { id: 'reports', title: 'Báo cáo', description: 'Xuất báo cáo theo kỳ và nguồn dữ liệu' },
  ] },
  { title: 'HỆ THỐNG', pages: [
    { id: 'settings', title: 'Cài đặt', description: 'Cập nhật hồ sơ người sử dụng trên máy' },
  ] },
];

const pages = groups.flatMap((group) => group.pages);

const roleTitle: Record<LocalOperator['role'], string> = {
  SALES: 'Sales', SUP: 'SUP', ASM: 'ASM',
};

export default function Workspace({ operator, onUpdate }: {
  operator: LocalOperator;
  onUpdate: (input: OperatorInput) => Promise<void>;
}) {
  const [pageId, setPageId] = useState<PageId>('dashboard');
  const [saved, setSaved] = useState(false);
  const current = pages.find((page) => page.id === pageId) ?? pages[0];

  async function update(input: OperatorInput) {
    await onUpdate(input);
    setSaved(true);
  }

  return (
    <div className="workspace">
      <a className="skip-link" href="#page-content">Chuyển đến nội dung chính</a>
      <header className="workspace-header">
        <div className="brand">
          <span className="app-mark small" aria-hidden="true">SC</span>
          <div className="brand-label">
            <Text weight="semibold" size={400}>Sales Supervisor</Text>
            <Text size={200} className="brand-subtitle">Quản lý phân phối · Offline</Text>
          </div>
        </div>
        <div className="user-chip">
          <Badge appearance="tint" color="informative">{roleTitle[operator.role]}</Badge>
          <Text weight="medium">{operator.displayName}</Text>
        </div>
      </header>

      <div className="workspace-body">
        <nav className="sidebar" aria-label="Điều hướng ứng dụng">
          {groups.map((group) => (
            <div className="nav-group" key={group.title}>
              <Text size={200} weight="semibold" className="nav-group-title">{group.title}</Text>
              {group.pages.map((page) => (
                <Button key={page.id} appearance="subtle" size="medium"
                  className={page.id === pageId ? 'nav-item selected' : 'nav-item'}
                  aria-current={page.id === pageId ? 'page' : undefined}
                  onClick={() => { setPageId(page.id); setSaved(false); }}>
                  {page.title}
                </Button>
              ))}
            </div>
          ))}
        </nav>

        <div className="work-region">
          <div className="contextbar" aria-label="Trạng thái phạm vi báo cáo">
            <span className="context-pill">Kỳ dữ liệu: chưa có</span>
            <span className="context-pill">Nhà phân phối: chưa có</span>
            <Badge appearance="outline">Dữ liệu lưu cục bộ</Badge>
          </div>
          <main id="page-content" className="page-content" tabIndex={-1}>
            <div className="page-header">
              <div>
                <Text className="eyebrow" weight="semibold" size={200}>KHÔNG GIAN LÀM VIỆC</Text>
                <Title2>{current.title}</Title2>
                <Text>{current.description}</Text>
              </div>
              <Badge appearance="tint" color="warning">Chưa có dữ liệu</Badge>
            </div>
            {pageId === 'settings' ? (
              <div className="page-grid">
                <Card className="page-card">
                  <Title3>Hồ sơ người sử dụng</Title3>
                  <Text>Chỉnh sửa hồ sơ duy nhất trên máy. Không tạo thêm tài khoản.</Text>
                  <OperatorForm key={operator.displayName + operator.role}
                    initial={operator} submitLabel="Lưu thay đổi" onSubmit={update} />
                  {saved ? <Text role="status" className="save-success">Đã lưu thay đổi trên máy.</Text> : null}
                </Card>
                <Card className="page-card subtle-card">
                  <Title3>Phạm vi dữ liệu</Title3>
                  <Text>Chưa cấu hình nhà phân phối, dữ liệu nhập hoặc sao lưu.</Text>
                  <Text size={200}>Các chức năng nhập dữ liệu và sao lưu sẽ được bổ sung ở giai đoạn kế tiếp.</Text>
                </Card>
              </div>
            ) : (
              <div className="page-grid">
                <Card className="empty-state" appearance="filled-alternative">
                  <span className="empty-symbol" aria-hidden="true">○</span>
                  <Title3>Chưa có dữ liệu để hiển thị</Title3>
                  <Text>Không có số liệu mẫu hoặc chỉ số được tạo tự động.</Text>
                  <Text>Chức năng {current.title.toLowerCase()} sẽ được bổ sung ở các giai đoạn tiếp theo.</Text>
                  <Button appearance="secondary" onClick={() => setPageId('imports')}>Xem khu vực dữ liệu & Import</Button>
                </Card>
                <Card className="page-card subtle-card">
                  <Text weight="semibold">Trạng thái dữ liệu</Text>
                  <div className="data-line"><Text>Nhà phân phối</Text><Badge appearance="outline">Chưa nhập</Badge></div>
                  <div className="data-line"><Text>Doanh số</Text><Badge appearance="outline">Chưa nhập</Badge></div>
                  <div className="data-line"><Text>Ngày cập nhật</Text><Text>Chưa có</Text></div>
                  <Text size={200}>Trạng thái nguồn dữ liệu sẽ được cập nhật khi có Import Center.</Text>
                </Card>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
