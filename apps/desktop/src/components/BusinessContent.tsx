import { Badge, Button, Text } from '@fluentui/react-components';
import type { ReactNode } from 'react';
import type { PageId } from './pageModel';

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
  return <div className="unsupported-note"><Badge appearance="outline">Chưa hỗ trợ</Badge><Text size={200}>{feature} sẽ được triển khai trong M2/M3; màn hình này chỉ chuẩn bị cấu trúc.</Text></div>;
}

function SubtleLink({ onClick }: { onClick: () => void }) {
  return <Button appearance="secondary" size="small" onClick={onClick}>Xem khu vực Import</Button>;
}

function Dashboard({ view, onGoToImport }: { view: string; onGoToImport: () => void }) {
  if (view === 'Nguồn dữ liệu') return <>
    <SectionHeader title="Tình trạng nguồn dữ liệu" description="Mỗi nguồn cần có kỳ áp dụng và phiên bản đã xác nhận."><SubtleLink onClick={onGoToImport} /></SectionHeader>
    <DataTable label="nguồn" columns={['Nguồn nghiệp vụ', 'Nhà phân phối', 'Kỳ', 'Phiên bản', 'Trạng thái']} hint="Chưa có lô nhập nào được xác nhận." />
    <Notice title="Quy tắc dữ liệu">Thiếu dữ liệu không được diễn giải là doanh số bằng 0.</Notice>
  </>;
  if (view === 'Cảnh báo') return <>
    <SectionHeader title="Danh sách cần kiểm tra" description="Cảnh báo sẽ liên kết về lô và dòng nguồn khi engine nhập được triển khai." />
    <div className="panel-pad empty-panel"><span className="illustration-line" aria-hidden="true"/><h3>Chưa có dữ liệu để đánh giá cảnh báo</h3><p>Không hiển thị cảnh báo giả khi chưa có batch nguồn hợp lệ.</p></div>
    <Notice title="Cảnh báo nghiệp vụ">Các trạng thái MISSING, PARTIAL, STALE và CONFLICT sẽ xuất hiện sau khi có dữ liệu được kiểm tra.</Notice>
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

function Imports({ view }: { view: string }) {
  if (view === 'Ánh xạ cột') return <>
    <SectionHeader title="Ánh xạ dữ liệu nguồn" description="Mỗi định dạng Excel/CSV cần xác định sheet và tên cột tương ứng." />
    <div className="content-split equal"><section className="content-panel panel-pad"><h2>Cột dữ liệu đầu vào</h2><div className="mapping-empty">Chưa có file nguồn để đọc danh sách cột.</div></section><section className="content-panel panel-pad"><h2>Trường nghiệp vụ</h2><div className="mapping-empty">Chưa có profile ánh xạ được cấu hình.</div></section></div>
    <ComingSoon feature="Chọn tệp và lưu cấu hình ánh xạ" />
  </>;
  if (view === 'Lỗi dữ liệu') return <>
    <SectionHeader title="Dòng lỗi và cần xác minh" description="Khi import được phát triển, lỗi sẽ chỉ rõ sheet, dòng, cột và lý do." />
    <DataTable label="lỗi nhập" columns={['Lô dữ liệu', 'Sheet', 'Dòng', 'Cột', 'Vấn đề', 'Hướng xử lý']} />
    <Notice title="Không tự gán nhân viên">Mã nhân viên không xác định phải được giữ trong nhóm “Chưa gán”, không đoán theo tên.</Notice>
  </>;
  return <>
    <SectionHeader title="Quy trình nhập và xác nhận" description="Các bước bên dưới mô tả luồng chuẩn; công cụ nhập file chưa được bật." />
    <div className="process-track"><div><b>01</b><span>Chọn nguồn</span></div><div><b>02</b><span>Ánh xạ cột</span></div><div><b>03</b><span>Kiểm tra lỗi</span></div><div><b>04</b><span>Xác nhận lô</span></div></div>
    <div className="content-panel"><SectionHeader title="Lịch sử lô dữ liệu" description="Danh sách file, kỳ áp dụng và trạng thái kiểm tra." /><DataTable label="lô nhập" columns={['Tên file', 'Loại dữ liệu', 'NPP', 'Kỳ', 'Trạng thái', 'Cập nhật']} /></div>
    <ComingSoon feature="Đọc Excel/CSV và xác nhận batch" />
  </>;
}

function SalesIn({ view }: { view: string }) {
  const columns: Record<string, ColumnSet> = {
    'Tổng hợp': ['Nhà phân phối', 'Kỳ', 'Bán vào (VND)', 'Hàng trả (VND)', 'Thực hiện', 'Nguồn'],
    'Chứng từ': ['Ngày chứng từ', 'Số chứng từ', 'Nhà phân phối', 'Loại', 'Giá trị (VND)', 'Trạng thái'],
    'Theo SKU': ['Mã SKU', 'Tên hàng', 'ĐVT', 'Nhà phân phối', 'Số lượng', 'Giá trị (VND)'],
  };
  return <>
    <SectionHeader title={view === 'Tổng hợp' ? 'Doanh số bán vào' : view === 'Chứng từ' ? 'Đối chiếu chứng từ' : 'Chi tiết theo mã hàng'} description="Dựa trên hóa đơn đã ghi nhận và chứng từ hoàn hàng; không bao gồm PO chưa giao." />
    {view === 'Tổng hợp' ? <div className="metric-grid compact"><BlankMetric label="Bán vào" detail="Chưa có dữ liệu"/><BlankMetric label="Hàng trả" detail="Chưa có dữ liệu"/><BlankMetric label="Doanh số thuần" detail="Chưa có dữ liệu"/></div> : null}
    <DataTable label={view === 'Chứng từ' ? 'chứng từ Sales In' : view === 'Theo SKU' ? 'SKU Sales In' : 'Sales In'} columns={columns[view] ?? columns['Tổng hợp']} />
    <Notice title="Cách ghi nhận">Sales In thể hiện công ty bán vào NPP theo chứng từ hợp lệ, không đồng nghĩa NPP đã nhập kho.</Notice>
  </>;
}

function SalesOut({ view }: { view: string }) {
  if (view === 'Chưa gán') return <>
    <SectionHeader title="Doanh số chưa xác định nhân viên" description="Giữ nguyên các dòng không có mã nhân viên hợp lệ để đối soát; không tự phân bổ." />
    <div className="inline-stat"><b>Chưa có nguồn Sales Out</b><span>Không thể đánh giá phần chưa gán khi chưa nhập dữ liệu.</span></div>
    <DataTable label="doanh số chưa gán" columns={['Ngày giao', 'Nhà phân phối', 'Số chứng từ', 'Mã nhân viên nguồn', 'Giá trị (VND)', 'Lý do']} />
  </>;
  if (view === 'Theo nhân viên') return <>
    <SectionHeader title="Theo nhân viên kinh doanh" description="Doanh số được gắn với nhân sự và quan hệ quản lý có hiệu lực tại ngày giao." />
    <DataTable label="Sales Out theo nhân viên" columns={['Mã NVKD', 'Nhân viên', 'SUP hiệu lực', 'Nhà phân phối', 'Doanh số (VND)', 'Kỳ']} />
    <Notice title="Nguyên tắc phân công">Đổi người quản lý hôm nay không làm thay đổi kết quả lịch sử.</Notice>
  </>;
  if (view === 'Chứng từ') return <>
    <SectionHeader title="Chi tiết giao hàng" description="Chỉ chứng từ đã giao và hoàn hàng được ghi nhận theo quy tắc nguồn." />
    <DataTable label="chứng từ Sales Out" columns={['Ngày giao', 'Mã chứng từ', 'Điểm bán', 'Nhân viên', 'Loại', 'Giá trị (VND)']} />
  </>;
  return <>
    <SectionHeader title="Bán ra theo nhà phân phối" description="Theo dõi doanh số phát sinh thực tế và đối soát phân bổ cho nhân viên." />
    <div className="metric-grid compact"><BlankMetric label="Sales Out" detail="Chưa có dữ liệu"/><BlankMetric label="Đã gán nhân viên" detail="Chưa có dữ liệu"/><BlankMetric label="Chưa gán" detail="Chưa có dữ liệu"/></div>
    <DataTable label="tổng hợp Sales Out" columns={['Nhà phân phối', 'Kỳ', 'Doanh số (VND)', 'Đã gán', 'Chưa gán', 'Đối soát']} />
    <Notice title="Đảm bảo đối soát">Tổng Sales Out của NPP = doanh số nhân viên đã gán + phần chưa gán trong cùng kỳ.</Notice>
  </>;
}

function Inventory({ view }: { view: string }) {
  const columns: Record<string, ColumnSet> = {
    'Theo kỳ': ['Nhà phân phối', 'Kỳ', 'Tồn đầu', 'Nhập', 'Xuất', 'Tồn cuối'],
    'Đối chiếu tồn': ['Nhà phân phối', 'SKU', 'Tồn cuối tính toán', 'Tồn cuối khai báo', 'Chênh lệch', 'Trạng thái'],
    'Theo SKU': ['Mã SKU', 'Tên hàng', 'ĐVT', 'Kỳ', 'Nhập', 'Xuất', 'Tồn cuối'],
  };
  return <>
    <SectionHeader title={view === 'Theo kỳ' ? 'Luân chuyển tồn kho' : view === 'Đối chiếu tồn' ? 'Kiểm tra chênh lệch tồn kho' : 'Tồn kho theo mã hàng'} description="Theo dõi tồn kho theo kỳ, không cộng dồn snapshot tồn cuối giữa các kỳ." />
    <div className="equation-strip"><b>Tồn đầu</b><span>+</span><b>Nhập</b><span>−</span><b>Xuất</b><span>±</span><b>Điều chỉnh</b><span>=</span><b>Tồn cuối</b></div>
    <DataTable label="xuất nhập tồn" columns={columns[view] ?? columns['Theo kỳ']} />
    <Notice title="Kiểm tra nguồn kho" kind="warning">Cần đủ dữ liệu tồn đầu, nhập, xuất và điều chỉnh trước khi đánh giá số ngày tồn.</Notice>
  </>;
}

function Distributors({ view }: { view: string }) {
  if (view === 'Hồ sơ') return <>
    <SectionHeader title="Hồ sơ nhà phân phối" description="Chọn NPP trong danh sách sau khi danh mục được triển khai để xem thông tin chi tiết." />
    <div className="detail-grid"><div className="content-panel panel-pad"><h2>Thông tin chính</h2><div className="details-skeleton"><span>Mã NPP <b>Chưa chọn</b></span><span>Tên nhà phân phối <b>—</b></span><span>Địa bàn <b>—</b></span><span>Trạng thái <b>—</b></span></div></div><div className="content-panel panel-pad"><h2>Liên kết nghiệp vụ</h2><p>Thông tin tuyến, nhân viên và SKU sẽ hiển thị sau khi có danh mục.</p><ComingSoon feature="Quản lý hồ sơ NPP" /></div></div>
  </>;
  if (view === 'Tuyến bán hàng') return <>
    <SectionHeader title="Phạm vi tuyến bán hàng" description="Tuyến/địa bàn được gắn theo NPP và nhân viên có hiệu lực." />
    <DataTable label="tuyến bán hàng" columns={['Mã tuyến', 'Tên tuyến', 'Nhà phân phối', 'Nhân viên phụ trách', 'Hiệu lực từ', 'Hiệu lực đến']} />
  </>;
  return <>
    <SectionHeader title="Danh mục nhà phân phối" description="Nơi quản lý các NPP và phạm vi kinh doanh trên máy." />
    <div className="detail-grid"><div className="content-panel"><DataTable label="nhà phân phối" columns={['Mã NPP', 'Tên nhà phân phối', 'Khu vực', 'Trạng thái']} /></div><div className="content-panel panel-pad"><h2>Chi tiết NPP</h2><div className="empty-detail"><span aria-hidden="true">▤</span><p>Chưa có nhà phân phối được chọn.</p><small>Nhập danh mục ở giai đoạn M2 để xem thông tin.</small></div></div></div>
  </>;
}

function Team({ view }: { view: string }) {
  if (view === 'Cây quản lý') return <>
    <SectionHeader title="Cơ cấu cấp quản lý" description="Minh họa các cấp nghiệp vụ, không phải cây nhân sự thực tế." />
    <div className="org-levels"><div><strong>ASM</strong><span>Quản lý vùng</span></div><span aria-hidden="true">→</span><div><strong>SUP</strong><span>Giám sát bán hàng</span></div><span aria-hidden="true">→</span><div><strong>SALES</strong><span>Nhân viên kinh doanh</span></div></div>
    <div className="panel-pad empty-panel"><h3>Chưa có nhân sự để xây dựng cây quản lý</h3><p>Quan hệ báo cáo sẽ được tính theo ngày hiệu lực, không áp sơ đồ hiện tại lên quá khứ.</p></div>
  </>;
  if (view === 'Lịch sử phân công') return <>
    <SectionHeader title="Lịch sử phân công và quản lý" description="Theo dõi người quản lý, NPP và tuyến theo từng khoảng hiệu lực." />
    <DataTable label="lịch sử nhân sự" columns={['Nhân viên', 'Vai trò', 'Quản lý trực tiếp', 'NPP / Tuyến', 'Từ ngày', 'Đến ngày']} />
  </>;
  return <>
    <SectionHeader title="Danh sách đội ngũ" description="Quản lý thông tin nhân sự để gắn doanh số và tuyến — không cấp tài khoản đăng nhập." />
    <div className="role-legend"><span>ASM · Quản lý vùng</span><span>SUP · Giám sát</span><span>SALES · Nhân viên</span></div>
    <DataTable label="nhân viên kinh doanh" columns={['Mã NVKD', 'Họ tên', 'Vai trò', 'Người quản lý', 'NPP', 'Hiệu lực']} />
    <Notice title="Ứng dụng một người sử dụng">Nhân viên cấp dưới chỉ là dữ liệu quản lý doanh số, không phải tài khoản trong app.</Notice>
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

function Sku({ view }: { view: string }) {
  if (view === 'Xu hướng') return <>
    <SectionHeader title="Xu hướng SKU theo thời gian" description="Biểu đồ chỉ hiển thị khi có dữ liệu nguồn liên tục, đủ kỳ." />
    <div className="chart-empty"><span aria-hidden="true" className="chart-placeholder">▥</span><h3>Chưa đủ dữ liệu để vẽ xu hướng</h3><p>Không tạo đồ thị minh họa từ số liệu giả.</p></div>
  </>;
  if (view === 'Theo nhà phân phối') return <>
    <SectionHeader title="Cơ cấu sản phẩm theo NPP" description="So sánh sản phẩm theo đúng đơn vị quy đổi và kỳ dữ liệu." />
    <DataTable label="SKU theo nhà phân phối" columns={['Nhà phân phối', 'Mã SKU', 'Tên SKU', 'ĐVT', 'Sản lượng', 'Tỷ trọng']} />
  </>;
  return <>
    <SectionHeader title="Hiệu quả sản phẩm" description="Tập trung vào mã hàng, đơn vị chuẩn và đóng góp doanh số." />
    <div className="content-split"><div className="content-panel"><DataTable label="phân tích SKU" columns={['Mã SKU', 'Tên sản phẩm', 'ĐVT', 'Sản lượng', 'Doanh số (VND)', 'Tỷ trọng']} /></div><div className="content-panel panel-pad"><h2>Thông tin mã hàng</h2><div className="empty-detail"><span aria-hidden="true">▤</span><p>Chưa có sản phẩm để phân tích.</p><small>Cần danh mục SKU và dữ liệu Sales hợp lệ.</small></div></div></div>
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
    <SectionHeader title="Điều kiện nguồn cho báo cáo" description="Báo cáo cần truy vết ngược về batch và thời điểm dữ liệu." />
    <DataTable label="nguồn báo cáo" columns={['Báo cáo', 'Nguồn', 'Kỳ', 'Batch', 'Tình trạng']} />
    <Notice title="Truy xuất nguồn">File xuất sau này cần ghi kỳ, bộ lọc, thời điểm xuất và nguồn dữ liệu.</Notice>
  </>;
  return <>
    <SectionHeader title="Danh mục báo cáo" description="Chọn nhóm nội dung cần theo dõi. Chức năng xuất file sẽ có ở M3." />
    <div className="report-grid">{reportKinds.map((item) => <div className="report-kind" key={item.title}><span className="report-icon" aria-hidden="true">▤</span><div><h3>{item.title}</h3><p>{item.detail}</p></div><Badge appearance="outline">Chưa hỗ trợ</Badge></div>)}</div>
    <ComingSoon feature="Xem trước và xuất báo cáo" />
  </>;
}

export default function BusinessContent({ pageId, view, onGoToImport }: Props) {
  switch (pageId) {
    case 'dashboard': return <Dashboard view={view} onGoToImport={onGoToImport} />;
    case 'imports': return <Imports view={view} />;
    case 'sales-in': return <SalesIn view={view} />;
    case 'sales-out': return <SalesOut view={view} />;
    case 'inventory': return <Inventory view={view} />;
    case 'distributors': return <Distributors view={view} />;
    case 'team': return <Team view={view} />;
    case 'targets': return <Targets view={view} />;
    case 'sku': return <Sku view={view} />;
    case 'reports': return <Reports view={view} />;
  }
}
