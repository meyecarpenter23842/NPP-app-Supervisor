import { Badge, Button, Text } from '@fluentui/react-components';
import type { ReactNode } from 'react';
import type { PageId } from './pageModel';
import MasterDataContent from './MasterDataContent';
import CatalogWorkspace from './CatalogWorkspace';
import ImportContent from './ImportContent';

interface Props { pageId: PageId; view: string; onGoToImport: () => void }

type ColumnSet = readonly string[];

/** Empty data tables deliberately contain no sample records, fake financials or inferred staff. */
function DataTable({ columns, label, hint }: { columns: ColumnSet; label: string; hint?: string }) {
  return (
    <div className="business-table-wrap" role="region" aria-label={label} tabIndex={0}>
      <table className="business-table">
        <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody><tr><td colSpan={columns.length}>
          <div className="table-empty">
            <span className="table-empty-icon" aria-hidden="true">▤</span>
            <strong>Chưa có dữ liệu {label.toLowerCase()}</strong>
            <span>{hint ?? 'Dữ liệu sẽ được hiển thị khi tính năng nhập và xử lý nguồn tương ứng hoàn tất.'}</span>
          </div>
        </td></tr></tbody>
      </table>
    </div>
  );
}

function SectionHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className="section-head"><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{children}</div>;
}

function BlankMetric({ label, detail }: { label: string; detail: string }) {
  return <div className="metric-box"><span className="metric-label">{label}</span><strong>—</strong><span className="metric-foot">{detail}</span></div>;
}

function Notice({ title, children, kind = 'info' }: { title: string; children: ReactNode; kind?: 'info' | 'warning' }) {
  return <div className={`inline-notice ${kind}`} role="note"><span aria-hidden="true" className="notice-glyph">{kind === 'warning' ? '!' : 'i'}</span><div><strong>{title}</strong><p>{children}</p></div></div>;
}

function ComingSoon({ feature }: { feature: string }) {
  return <div className="unsupported-note"><Badge appearance="outline">Chưa hỗ trợ</Badge><Text size={200}>{feature} chưa được hỗ trợ trong phiên bản này.</Text></div>;
}

function SubtleLink({ onClick }: { onClick: () => void }) {
  return <Button appearance="secondary" size="small" onClick={onClick}>Đến phần Nhập dữ liệu</Button>;
}

function Dashboard({ view, onGoToImport }: { view: string; onGoToImport: () => void }) {
  if (view === 'Nguồn dữ liệu') return <>
    <SectionHeader title="Tình trạng nguồn dữ liệu" description="Mỗi nguồn cần có kỳ áp dụng và phiên bản đã xác nhận."><SubtleLink onClick={onGoToImport} /></SectionHeader>
    <DataTable label="nguồn" columns={['Nguồn nghiệp vụ', 'Nhà phân phối', 'Kỳ', 'Phiên bản', 'Trạng thái']} hint="Chưa có lần nhập dữ liệu nào được xác nhận." />
    <Notice title="Quy tắc dữ liệu">Thiếu dữ liệu không được diễn giải là doanh số bằng 0.</Notice>
  </>;
  if (view === 'Cảnh báo') return <>
    <SectionHeader title="Danh sách cần kiểm tra" description="Khi có dữ liệu, mỗi cảnh báo sẽ cho biết tệp và dòng cần kiểm tra." />
    <div className="panel-pad empty-panel"><span className="illustration-line" aria-hidden="true"/><h3>Chưa có dữ liệu để đánh giá cảnh báo</h3><p>Chỉ hiển thị cảnh báo khi có dữ liệu đã được kiểm tra.</p></div>
    <Notice title="Cảnh báo nghiệp vụ">Các trạng thái chưa có dữ liệu, thiếu dữ liệu, dữ liệu đã cũ và dữ liệu không khớp sẽ xuất hiện khi có kết quả kiểm tra.</Notice>
  </>;
  return <>
    <SectionHeader title="Chỉ số điều hành" description="Chưa có kỳ báo cáo hoặc nhà phân phối được nhập."><SubtleLink onClick={onGoToImport} /></SectionHeader>
    <div className="metric-grid"><BlankMetric label="Sales In" detail="Chưa có nguồn chứng từ"/><BlankMetric label="Sales Out" detail="Chưa có dữ liệu giao hàng"/><BlankMetric label="Tồn kho" detail="Chưa có kỳ đối chiếu"/><BlankMetric label="Hoàn thành KPI" detail="Chưa có chỉ tiêu"/></div>
    <div className="content-split">
      <section className="content-panel"><SectionHeader title="Theo dõi theo nhà phân phối" description="Doanh số và tình trạng xử lý dữ liệu."/><DataTable label="tổng hợp nhà phân phối" columns={['Nhà phân phối', 'Sales In', 'Sales Out', 'Kỳ', 'Nguồn']} /></section>
      <section className="content-panel panel-pad"><h2>Bắt đầu từ dữ liệu nguồn</h2><p>Để theo dõi kết quả thực tế, dữ liệu NPP, danh mục và chứng từ cần được kiểm tra trước khi tính toán.</p><div className="check-sequence"><span>01 · Danh mục NPP / SKU</span><span>02 · Nhân sự / phân công</span><span>03 · Sales In / Out / XNT</span><span>04 · Chỉ tiêu kỳ</span></div><SubtleLink onClick={onGoToImport} /></section>
    </div>
  </>;
}

function SalesIn({ view }: { view: string }) {
  const columns: Record<string, ColumnSet> = {
    'Tổng hợp': ['Nhà phân phối', 'Kỳ', 'Bán vào (VND)', 'Hàng trả (VND)', 'Thực hiện', 'Nguồn'],
    'Chứng từ': ['Ngày chứng từ', 'Số chứng từ', 'Nhà phân phối', 'Loại', 'Giá trị (VND)', 'Trạng thái'],
    'Theo SKU': ['Mã SKU', 'Tên hàng', 'Đơn vị tính', 'Nhà phân phối', 'Số lượng', 'Giá trị (VND)'],
  };
  return <>
    <SectionHeader title={view === 'Tổng hợp' ? 'Doanh số bán vào' : view === 'Chứng từ' ? 'Đối chiếu chứng từ' : 'Chi tiết theo mã hàng'} description="Dựa trên hóa đơn đã ghi nhận và chứng từ hoàn hàng; không bao gồm đơn đặt hàng chưa giao." />
    {view === 'Tổng hợp' ? <div className="metric-grid compact"><BlankMetric label="Bán vào" detail="Chưa có dữ liệu"/><BlankMetric label="Hàng trả" detail="Chưa có dữ liệu"/><BlankMetric label="Doanh số thuần" detail="Chưa có dữ liệu"/></div> : null}
    <DataTable label={view === 'Chứng từ' ? 'chứng từ Sales In' : view === 'Theo SKU' ? 'SKU Sales In' : 'Sales In'} columns={columns[view] ?? columns['Tổng hợp']} />
    <Notice title="Cách ghi nhận">Sales In thể hiện công ty bán vào NPP theo chứng từ hợp lệ, không đồng nghĩa NPP đã nhập kho.</Notice>
  </>;
}

function SalesOut({ view }: { view: string }) {
  if (view === 'Chưa xác định nhân viên') return <>
    <SectionHeader title="Doanh số chưa xác định nhân viên" description="Giữ nguyên các dòng không có mã nhân viên hợp lệ để đối soát; không tự phân bổ." />
    <div className="inline-stat"><b>Chưa nhập dữ liệu bán ra</b><span>Không thể đánh giá phần chưa xác định nhân viên khi chưa nhập dữ liệu.</span></div>
    <DataTable label="doanh số chưa xác định nhân viên" columns={['Ngày giao', 'Nhà phân phối', 'Số chứng từ', 'Mã nhân viên trên tệp NPP', 'Giá trị (VND)', 'Lý do']} />
  </>;
  if (view === 'Theo nhân viên') return <>
    <SectionHeader title="Theo nhân viên kinh doanh" description="Doanh số được gắn với nhân sự và quan hệ quản lý có hiệu lực tại ngày giao." />
    <DataTable label="Sales Out theo nhân viên" columns={['Mã NVKD', 'Nhân viên', 'SUP tại ngày bán', 'Nhà phân phối', 'Doanh số (VND)', 'Kỳ']} />
    <Notice title="Nguyên tắc phân công">Đổi người quản lý hôm nay không làm thay đổi kết quả lịch sử.</Notice>
  </>;
  if (view === 'Chứng từ') return <>
    <SectionHeader title="Chi tiết giao hàng" description="Chỉ chứng từ đã giao và hoàn hàng được ghi nhận theo quy tắc nguồn." />
    <DataTable label="chứng từ Sales Out" columns={['Ngày giao', 'Mã chứng từ', 'Điểm bán', 'Nhân viên', 'Loại', 'Giá trị (VND)']} />
  </>;
  return <>
    <SectionHeader title="Bán ra theo nhà phân phối" description="Theo dõi doanh số phát sinh thực tế và đối soát phân bổ cho nhân viên." />
    <div className="metric-grid compact"><BlankMetric label="Sales Out" detail="Chưa có dữ liệu"/><BlankMetric label="Đã xác định nhân viên" detail="Chưa có dữ liệu"/><BlankMetric label="Chưa xác định nhân viên" detail="Chưa có dữ liệu"/></div>
    <DataTable label="tổng hợp Sales Out" columns={['Nhà phân phối', 'Kỳ', 'Doanh số (VND)', 'Đã xác định nhân viên', 'Chưa xác định nhân viên', 'Chênh lệch']} />
    <Notice title="Đảm bảo đối soát">Tổng Sales Out của NPP = doanh số đã xác định nhân viên + phần chưa xác định trong cùng kỳ.</Notice>
  </>;
}

function Inventory({ view }: { view: string }) {
  const columns: Record<string, ColumnSet> = {
    'Theo kỳ': ['Nhà phân phối', 'Kỳ', 'Tồn đầu', 'Nhập', 'Xuất', 'Tồn cuối'],
    'Kiểm tra chênh lệch': ['Nhà phân phối', 'SKU', 'Tồn cuối tính toán', 'Tồn cuối khai báo', 'Chênh lệch', 'Trạng thái'],
    'Theo SKU': ['Mã SKU', 'Tên hàng', 'Đơn vị tính', 'Kỳ', 'Nhập', 'Xuất', 'Tồn cuối'],
  };
  return <>
    <SectionHeader title={view === 'Theo kỳ' ? 'Luân chuyển tồn kho' : view === 'Kiểm tra chênh lệch' ? 'Kiểm tra chênh lệch tồn kho' : 'Tồn kho theo mã hàng'} description="Theo dõi tồn kho theo kỳ, không cộng dồn snapshot tồn cuối giữa các kỳ." />
    <div className="equation-strip"><b>Tồn đầu</b><span>+</span><b>Nhập</b><span>−</span><b>Xuất</b><span>±</span><b>Điều chỉnh</b><span>=</span><b>Tồn cuối</b></div>
    <DataTable label="xuất nhập tồn" columns={columns[view] ?? columns['Theo kỳ']} />
    <Notice title="Kiểm tra nguồn kho" kind="warning">Cần đủ dữ liệu tồn đầu, nhập, xuất và điều chỉnh trước khi đánh giá số ngày tồn.</Notice>
  </>;
}

function Targets({ view }: { view: string }) {
  const cols: Record<string, ColumnSet> = {
    'Chỉ tiêu': ['Kỳ tháng', 'Cấp giao', 'Đối tượng', 'Chỉ tiêu (VND)', 'Nguồn', 'Trạng thái'],
    'Thực hiện': ['Kỳ tháng', 'Đối tượng', 'Thực hiện (VND)', 'Chỉ tiêu', 'Tỷ lệ đạt', 'Nguồn'],
    'Đối chiếu KPI': ['Kỳ tháng', 'Cấp', 'Doanh số', 'Chỉ tiêu', 'Chênh lệch', 'Dữ liệu đủ?'],
  };
  return <>
    <SectionHeader title={view === 'Chỉ tiêu' ? 'Chỉ tiêu theo kỳ' : view === 'Thực hiện' ? 'Kết quả thực hiện' : 'Đối chiếu KPI'} description="Kết quả chỉ có ý nghĩa khi chọn đúng cấp NPP, SALES hoặc SUP và cùng kỳ báo cáo." />
    {view === 'Thực hiện' ? <div className="metric-grid compact"><BlankMetric label="Chỉ tiêu" detail="Chưa có nguồn"/><BlankMetric label="Thực hiện" detail="Chưa có nguồn"/><BlankMetric label="Tỷ lệ đạt" detail="Không thể tính"/></div> : null}
    <DataTable label="chỉ tiêu và KPI" columns={cols[view] ?? cols['Chỉ tiêu']} />
    <Notice title="Tránh cộng trùng">Không cộng doanh số/target cùng lúc ở cấp nhân viên và cấp quản lý.</Notice>
  </>;
}

const reportKinds = [
  { title: 'Doanh số', detail: 'Sales In / Out theo kỳ và NPP' },
  { title: 'Tồn kho', detail: 'Xuất nhập tồn và chênh lệch' },
  { title: 'Đội ngũ', detail: 'Doanh số theo nhân viên, SUP' },
  { title: 'Chỉ tiêu', detail: 'Thực hiện và tỷ lệ KPI' },
];
function Reports({ view }: { view: string }) {
  if (view === 'Lịch sử xuất') return <>
    <SectionHeader title="Lịch sử tạo báo cáo" description="Các lần xuất sẽ lưu loại báo cáo, bộ lọc, kỳ và nguồn dữ liệu." />
    <DataTable label="lịch sử xuất báo cáo" columns={['Thời gian', 'Báo cáo', 'Phạm vi', 'Kỳ', 'Định dạng', 'Nguồn']} />
    <ComingSoon feature="Xuất file Excel" />
  </>;
  if (view === 'Nguồn dữ liệu') return <>
    <SectionHeader title="Điều kiện nguồn cho báo cáo" description="Mỗi báo cáo cần ghi rõ dữ liệu được lấy từ lần nhập nào và ngày nào." />
    <DataTable label="nguồn báo cáo" columns={['Báo cáo', 'Nguồn', 'Kỳ', 'Lần nhập', 'Tình trạng']} />
    <Notice title="Truy xuất nguồn">File xuất sau này cần ghi kỳ, bộ lọc, thời điểm xuất và nguồn dữ liệu.</Notice>
  </>;
  return <>
    <SectionHeader title="Danh mục báo cáo" description="Chọn nhóm nội dung cần theo dõi. Chưa thể xuất file trong phiên bản này." />
    <div className="report-grid">{reportKinds.map((item) => <div className="report-kind" key={item.title}><span className="report-icon" aria-hidden="true">▤</span><div><h3>{item.title}</h3><p>{item.detail}</p></div><Badge appearance="outline">Chưa hỗ trợ</Badge></div>)}</div>
    <ComingSoon feature="Xem trước và xuất báo cáo" />
  </>;
}

export default function BusinessContent({ pageId, view, onGoToImport }: Props) {
  switch (pageId) {
    case 'dashboard': return <Dashboard view={view} onGoToImport={onGoToImport} />;
    case 'imports': return <ImportContent view={view} />;
    case 'sales-in': return <SalesIn view={view} />;
    case 'sales-out': return <SalesOut view={view} />;
    case 'inventory': return <Inventory view={view} />;
    case 'distributors': return <MasterDataContent key={view} pageId="distributors" view={view} />;
    case 'team': return <MasterDataContent key={view} pageId="team" view={view} />;
    case 'targets': return <Targets view={view} />;
    case 'sku': return <CatalogWorkspace view={view} />;
    case 'reports': return <Reports view={view} />;
  }
}
