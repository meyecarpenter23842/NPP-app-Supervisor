import { useRef, useState, type KeyboardEvent } from 'react';
import { Badge, Button, Text, Title2 } from '@fluentui/react-components';
import OperatorForm from './OperatorForm';
import BusinessContent from './BusinessContent';
import { businessGroups, businessPages, getDefaultView, getPage, getValidView, type PageId } from './pageModel';
import type { LocalOperator, OperatorInput } from '../ipc';

const roleTitle: Record<LocalOperator['role'], string> = { SALES: 'Sales', SUP: 'SUP', ASM: 'ASM' };

const shapes: Record<PageId, string> = {
  dashboard: 'M3 3h7v7H3z M12 3h7v4h-7z M12 10h7v10h-7z M3 13h7v7H3z',
  imports: 'M12 3v11m0 0-4-4m4 4 4-4 M4 15v5h16v-5',
  'sales-in': 'M4 18h16 M7 15l4-4 3 3 5-7 M15 7h4v4',
  'sales-out': 'M4 6h16v12H4z M8 11h8 M13 8l3 3-3 3',
  inventory: 'M3 7l9-4 9 4-9 4z M3 7v10l9 4 9-4V7 M12 11v10',
  distributors: 'M3 20V8l9-5 9 5v12 M8 20v-7h8v7 M3 10h18',
  team: 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M5 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M19 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M12 10v3 M5 15v-2h14v2',
  targets: 'M3 20h18 M6 16v-5 M12 16V7 M18 16V4',
  sku: 'M4 5h16v14H4z M8 5v14 M12 8h5 M12 12h5 M12 16h3',
  reports: 'M6 3h9l4 4v14H6z M15 3v5h4 M9 12h7 M9 16h7',
};

function NavIcon({ id }: { id: PageId }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={shapes[id]} /></svg>;
}

export default function Workspace({ operator, onUpdate }: {
  operator: LocalOperator;
  onUpdate: (input: OperatorInput) => Promise<void>;
}) {
  const [pageId, setPageId] = useState<PageId>('dashboard');
  const [viewId, setViewId] = useState(getDefaultView('dashboard'));
  const [showSettings, setShowSettings] = useState(false);
  const [saved, setSaved] = useState(false);
  const profileRef = useRef<HTMLDetailsElement>(null);
  const viewButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const current = getPage(pageId);
  const activeView = getValidView(pageId, viewId);

  function choosePage(next: PageId) {
    setPageId(next);
    setViewId(getDefaultView(next));
    setShowSettings(false);
    setSaved(false);
    if (profileRef.current) profileRef.current.open = false;
  }

  function chooseSettings() {
    setShowSettings(true);
    setSaved(false);
    if (profileRef.current) profileRef.current.open = false;
  }

  function onViewKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = current.views.length;
    let target = index;
    if (event.key === 'ArrowRight') target = (index + 1) % count;
    else if (event.key === 'ArrowLeft') target = (index + count - 1) % count;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = count - 1;
    else return;
    event.preventDefault();
    setViewId(current.views[target]);
    viewButtons.current[target]?.focus();
  }

  async function update(input: OperatorInput) {
    await onUpdate(input);
    setSaved(true);
  }

  return <div className="workspace">
    <a className="skip-link" href="#page-content">Chuyển đến nội dung chính</a>
    <header className="workspace-header">
      <div className="brand"><div className="app-mark small" aria-hidden="true">SC</div><div className="brand-label"><strong>Sales Supervisor</strong><span>Trung tâm quản lý phân phối</span></div></div>
      <div className="header-end"><span className="storage-indicator"><span className="storage-dot" aria-hidden="true"/>Dữ liệu trên máy</span>
        <details className="profile-menu" ref={profileRef}>
          <summary aria-label={`Menu người sử dụng: ${operator.displayName}`}><span className="avatar" aria-hidden="true">{operator.displayName.trim().charAt(0).toLocaleUpperCase('vi')}</span><span className="profile-text"><strong>{operator.displayName}</strong><small>{roleTitle[operator.role]}</small></span><span className="chevron" aria-hidden="true">⌄</span></summary>
          <div className="profile-dropdown"><strong>Hệ thống</strong><button type="button" onClick={chooseSettings}>Hồ sơ & Cài đặt</button><p>Thông tin sao lưu và giấy phép nằm trong Cài đặt.</p></div>
        </details>
      </div>
    </header>
    <div className="workspace-body">
      <nav className="sidebar" aria-label="Điều hướng nghiệp vụ">
        <div className="sidebar-meta"><span>KHÔNG GIAN QUẢN LÝ</span><strong>Supervisor</strong></div>
        {businessGroups.map((group) => <div className="nav-group" key={group}>
          <div className="nav-group-title">{group}</div>
          {businessPages.filter((item) => item.group === group).map((item) => <button key={item.id} type="button" className={`nav-item ${!showSettings && item.id === pageId ? 'selected' : ''}`}
            aria-current={!showSettings && item.id === pageId ? 'page' : undefined} onClick={() => choosePage(item.id)}><NavIcon id={item.id} /><span>{item.shortTitle}</span></button>)}
        </div>)}
        <div className="sidebar-bottom"><div className="sidebar-status"><span className="status-ring" aria-hidden="true"/><strong>Chế độ ngoại tuyến</strong><small>Dữ liệu lưu trên máy này</small></div></div>
      </nav>
      <div className="work-region">
        <div className="contextbar"><div className="breadcrumbs"><span>Không gian làm việc</span><span aria-hidden="true">/</span><strong>{showSettings ? 'Cài đặt' : current.title}</strong></div><div className="context-trailing"><span>Chưa có kỳ dữ liệu</span><Badge appearance="outline">Chưa có nguồn</Badge></div></div>
        <main id="page-content" className="page-content" tabIndex={-1}>
          {showSettings ? <>
            <div className="page-header"><div><Title2>Cài đặt</Title2><Text>Thông tin người sử dụng và khả năng quản lý dữ liệu trên máy.</Text></div><Button appearance="secondary" onClick={() => choosePage(pageId)}>Quay lại {current.title}</Button></div>
            <div className="settings-layout"><section className="content-panel panel-pad"><h2>Hồ sơ người sử dụng</h2><p>Chỉnh sửa hồ sơ duy nhất của thiết bị. Không tạo tài khoản khác.</p><OperatorForm key={`${operator.displayName}:${operator.role}`} initial={operator} submitLabel="Lưu thay đổi" onSubmit={update}/>{saved ? <div role="status" className="save-success">Đã lưu thay đổi trên máy.</div> : null}</section>
            <div className="settings-side"><section className="content-panel panel-pad"><h2>Sao lưu & Khôi phục</h2><Badge appearance="outline">Chưa hỗ trợ</Badge><p>Chưa thể sao lưu hoặc khôi phục dữ liệu trong phiên bản này.</p></section><section className="content-panel panel-pad"><h2>Giấy phép & Cập nhật</h2><Badge appearance="outline">Chưa hỗ trợ</Badge><p>Chưa thể kiểm tra giấy phép hoặc cập nhật ứng dụng trong phiên bản này.</p></section></div></div>
          </> : <>
            <div className="page-header"><div><Title2>{current.title}</Title2><Text>{current.description}</Text></div><div className="page-status"><Badge appearance="outline">{pageId === "distributors" || pageId === "team" || (pageId === "sku" && activeView === "Danh mục sản phẩm") ? "Dữ liệu trên máy" : "Chưa có dữ liệu"}</Badge></div></div>
            {pageId === "distributors" || pageId === "team" || (pageId === "sku" && activeView === "Danh mục sản phẩm") ? <div className="page-toolbar" role="note">Danh mục và phân công được lưu trên máy này. Bộ lọc kỳ dùng khi đã có báo cáo doanh số.</div> : <div className="page-toolbar" aria-label="Bộ lọc báo cáo"><div className="filter-field"><span>Kỳ dữ liệu</span><select aria-label="Kỳ dữ liệu" disabled defaultValue="missing"><option value="missing">Chưa có kỳ</option></select></div><div className="filter-field"><span>Nhà phân phối</span><select aria-label="Nhà phân phối" disabled defaultValue="missing"><option value="missing">Chưa có NPP</option></select></div><div className="filter-caption" role="note">Chưa có dữ liệu để lọc</div></div>}
            <div className="subnav" role="tablist" aria-label={`Các màn hình ${current.title}`}>
              {current.views.map((view, index) => <button ref={(el) => { viewButtons.current[index] = el; }} type="button" key={`${pageId}-${view}`} role="tab"
                id={`subtab-${pageId}-${index}`} aria-controls="business-panel" aria-selected={activeView === view}
                tabIndex={activeView === view ? 0 : -1} className={`subnav-tab ${activeView === view ? 'active' : ''}`}
                onClick={() => setViewId(view)} onKeyDown={(event) => onViewKey(event, index)}>{view}</button>)}
            </div>
            <div className="business-content" id="business-panel" role="tabpanel" aria-labelledby={`subtab-${pageId}-${current.views.indexOf(activeView)}`} data-page={pageId} data-view={activeView}>
              <BusinessContent pageId={pageId} view={activeView} onGoToImport={() => choosePage('imports')} />
            </div>
          </>}
        </main>
      </div>
    </div>
  </div>;
}
