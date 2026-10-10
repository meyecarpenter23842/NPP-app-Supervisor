import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@fluentui/react-components';
import { desktopApi, normalizeIpcError, type MasterItem, type MasterKind, type MasterLinkKind, type MasterSnapshot, type NewMasterLink } from '../ipc';

type Page = 'distributors' | 'team' | 'sku';
const kinds: Record<Page, MasterKind[]> = { distributors: ['NPP', 'ROUTE'], team: ['EMPLOYEE'], sku: ['FAMILY', 'SKU'] };
const mappingKinds: Record<Page, MasterLinkKind[]> = { distributors: [], team: ['MANAGER', 'NPP_STAFF', 'EMPLOYEE_ALIAS', 'ROUTE_STAFF'], sku: ['SKU_ALIAS', 'SKU_UNIT'] };
const captions: Record<MasterKind | MasterLinkKind, string> = {
  NPP: 'Nhà phân phối', ROUTE: 'Tuyến bán hàng', FAMILY: 'Sản phẩm', SKU: 'Mã hàng (SKU)',
  EMPLOYEE: 'Nhân viên', MANAGER: 'Người quản lý trực tiếp', NPP_STAFF: 'Nhân viên phụ trách NPP',
  EMPLOYEE_ALIAS: 'Mã nhân viên trong tệp NPP', ROUTE_STAFF: 'Phân công tuyến',
  SKU_ALIAS: 'Mã hàng trong tệp NPP', SKU_UNIT: 'Quy đổi đơn vị hàng',
};
const empty: MasterSnapshot = { distributors: [], families: [], skus: [], employees: [], routes: [], links: [] };

export default function MasterDataContent({ pageId, view }: { pageId: Page; view: string }) {
  const [data, setData] = useState<MasterSnapshot>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [kind, setKind] = useState<MasterKind>(view === 'Tuyến bán hàng' ? 'ROUTE' : kinds[pageId][0]);
  const [code, setCode] = useState(''); const [name, setName] = useState('');
  const [detail, setDetail] = useState('SALES'); const [parentId, setParentId] = useState('');
  const [search, setSearch] = useState('');
  const [linkKind, setLinkKind] = useState<MasterLinkKind>(mappingKinds[pageId][0] ?? 'SKU_ALIAS');
  const [subjectId, setSubjectId] = useState(''); const [relatedId, setRelatedId] = useState('');
  const [nppId, setNppId] = useState(''); const [rawCode, setRawCode] = useState('');
  const [unit, setUnit] = useState(''); const [num, setNum] = useState('1'); const [den, setDen] = useState('1');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [closeId, setCloseId] = useState(''); const [closeDate, setCloseDate] = useState('');
  const [editId, setEditId] = useState(''); const [editName, setEditName] = useState('');

  useEffect(() => {
    let live = true;
    desktopApi.listMasterData().then((v) => { if (live) setData(v); })
      .catch((reason: unknown) => { if (live) setError(normalizeIpcError(reason).message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  async function mutate(operation: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); setData(await desktopApi.listMasterData()); setNotice(message); }
    catch (reason: unknown) { setError(normalizeIpcError(reason).message); }
    finally { setBusy(false); }
  }
  function addItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void mutate(async () => {
      await desktopApi.createMasterItem({ kind, code, name,
        ...(kind === 'SKU' || kind === 'ROUTE' ? { parentId } : {}),
        ...(kind === 'SKU' || kind === 'EMPLOYEE' ? { detail } : {}) });
      setCode(''); setName('');
    }, 'Đã lưu danh mục trên máy.');
  }
  function addMapping(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ratio = linkKind === 'SKU_ALIAS' || linkKind === 'SKU_UNIT';
    const n = Number(num), d = Number(den);
    if (ratio && (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || n <= 0 || d <= 0)) {
      setError('Tỷ lệ quy đổi phải là số nguyên dương.'); return;
    }
    const request: NewMasterLink = {
      kind: linkKind, subjectId,
      ...(relatedId ? { relatedId } : {}), ...(nppId ? { distributorId: nppId } : {}),
      ...(rawCode ? { externalCode: rawCode } : {}), ...(unit ? { unitCode: unit } : {}),
      ...(ratio ? { ratioNum: n, ratioDen: d } : {}),
      ...(linkKind !== 'SKU_UNIT' ? { effectiveFrom: from, effectiveTo: to || null } : {}),
    };
    void mutate(async () => { await desktopApi.createMasterLink(request); setRawCode(''); }, 'Đã lưu mã NPP hoặc phân công theo ngày.');
  }
  const items = kind === 'NPP' ? data.distributors : kind === 'ROUTE' ? data.routes :
    kind === 'FAMILY' ? data.families : kind === 'SKU' ? data.skus : data.employees;
  const candidates = [...data.distributors, ...data.routes, ...data.families, ...data.skus, ...data.employees];
  const labelFor = (id: string | null) => {
    const found = candidates.find((item) => item.id === id);
    return found ? found.code + ' · ' + found.name : (id ?? '—');
  };
  const options = (list: MasterItem[]) => list.map((item) => <option key={item.id} value={item.id}>{labelFor(item.id)}</option>);
  const history = data.links.filter((item) => mappingKinds[pageId].includes(item.kind) && (view !== 'Sơ đồ quản lý' || item.kind === 'MANAGER'));
  const supportsMapping = mappingKinds[pageId].length > 0 && view !== 'Danh sách nhân sự';
  const subjects = pageId === 'sku' ? data.skus : data.employees;
  const related = linkKind === 'MANAGER' ? data.employees.filter((i) => i.id !== subjectId) : linkKind === 'ROUTE_STAFF' ? data.routes : [];
  const sourceNeeded = linkKind === 'SKU_ALIAS' || linkKind === 'EMPLOYEE_ALIAS';
  const ratioNeeded = linkKind === 'SKU_ALIAS' || linkKind === 'SKU_UNIT';
  const nppNeeded = ['SKU_ALIAS','EMPLOYEE_ALIAS','NPP_STAFF','ROUTE_STAFF'].includes(linkKind);
  return <div className="master-workspace">
    <div className="master-summary"><h2>{pageId === 'sku' ? 'Sản phẩm và mã hàng (SKU)' : pageId === 'team' ? 'Nhân sự và phân cấp' : 'Danh mục nhà phân phối'}</h2>
      <p>Danh mục được lưu trên máy. Chưa xác định được mã hàng hoặc nhân viên trong tệp NPP thì không tự chọn thay; cần kiểm tra mã trước khi sử dụng.</p></div>
    {loading ? <p role="status">Đang tải dữ liệu…</p> : null}
    {error ? <p role="alert" className="master-error">{error}</p> : null}
    {notice ? <p role="status" className="master-success">{notice}</p> : null}
    {!loading ? <>
      <section className="content-panel master-panel" aria-label="Danh mục chuẩn">
        <div className="master-head"><h3>Danh mục</h3><label>Loại <select value={kind} onChange={(e) => { setKind(e.target.value as MasterKind); setParentId(''); setDetail(e.target.value === 'SKU' ? '' : 'SALES'); }}>
          {kinds[pageId].map((item) => <option key={item} value={item}>{captions[item]}</option>)}</select></label></div>
        <form className="master-form" onSubmit={addItem}>
          <label>{kind === 'NPP' ? 'Mã NPP' : kind === 'FAMILY' ? 'Mã sản phẩm' : kind === 'SKU' ? 'Mã SKU' : kind === 'EMPLOYEE' ? 'Mã nhân viên' : 'Mã tuyến'} <input required maxLength={96} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Giữ nguyên mã có số 0 đầu" /></label>
          <label>{kind === 'EMPLOYEE' ? 'Họ tên' : 'Tên'} <input required value={name} maxLength={256} onChange={(e) => setName(e.target.value)} /></label>
          {kind === 'EMPLOYEE' ? <label>Vai trò <select value={detail} onChange={(e) => setDetail(e.target.value)}><option>SALES</option><option>SUP</option><option>ASM</option></select></label> : null}
          {kind === 'SKU' ? <><label>Thuộc sản phẩm<select required value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">Chọn sản phẩm</option>{options(data.families.filter((f) => f.active))}</select></label>
            <label>Đơn vị tính cơ sở <input required value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="LON/CHAI" /></label></> : null}
          {kind === 'ROUTE' ? <label>Thuộc NPP<select required value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">Chọn NPP</option>{options(data.distributors)}</select></label> : null}
          <Button appearance="primary" type="submit" disabled={busy}>Thêm mới</Button>
        </form>
        <div className="master-filter"><strong>{captions[kind]} ({items.length})</strong><input aria-label="Tìm mã hoặc tên" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã / tên" /></div>
        <div className="master-scroll"><table className="master-table"><thead><tr><th>Mã</th><th>Tên</th><th>Chi tiết</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {items.filter((item) => (item.code + ' ' + item.name).toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))).map((item) =>
            <tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td>{item.parentId ? labelFor(item.parentId) : item.detail ?? '—'}</td><td>{item.active ? 'Đang dùng' : 'Ngừng'}</td><td>
              <div className="master-actions"><Button size="small" appearance="subtle" disabled={busy} onClick={() => { setEditId(item.id); setEditName(item.name); }}>Đổi tên</Button>
                <Button size="small" appearance="subtle" disabled={busy} onClick={() => {
                  if (item.active && !window.confirm('Ngừng sử dụng? Dữ liệu lịch sử vẫn được giữ.')) return;
                  void mutate(() => desktopApi.setMasterActive({ kind, id: item.id, active: !item.active }), 'Đã cập nhật trạng thái.');
                }}>{item.active ? 'Ngừng' : 'Bật lại'}</Button></div></td></tr>)}
          {items.length === 0 ? <tr><td colSpan={5}>Chưa có dữ liệu danh mục.</td></tr> : null}
        </tbody></table></div>
        {editId ? <form className="master-form" onSubmit={(e) => { e.preventDefault(); void mutate(async () => {
          await desktopApi.renameMasterItem({ kind, id: editId, name: editName }); setEditId('');
        }, 'Đã đổi tên.'); }}><label>Tên mới<input required value={editName} onChange={(e) => setEditName(e.target.value)} /></label>
          <Button type="submit" appearance="primary" disabled={busy}>Lưu tên</Button><Button type="button" onClick={() => setEditId('')}>Hủy</Button></form> : null}
      </section>
      {supportsMapping ? <section className="content-panel master-panel" aria-label="Mã NPP và phân công">
        <h3>Mã NPP và lịch sử phân công</h3><form className="master-form" onSubmit={addMapping}>
          <label>Loại<select value={linkKind} onChange={(e) => { setLinkKind(e.target.value as MasterLinkKind); setSubjectId(''); setRelatedId(''); }}>{
            mappingKinds[pageId].map((kind) => <option key={kind} value={kind}>{captions[kind]}</option>)}</select></label>
          <label>{pageId === 'sku' ? 'SKU' : 'Nhân viên'}<select required value={subjectId} onChange={(e) => setSubjectId(e.target.value)}><option value="">Chọn</option>{options(subjects)}</select></label>
          {linkKind === 'MANAGER' || linkKind === 'ROUTE_STAFF' ? <label>{linkKind === 'MANAGER' ? 'Người quản lý' : 'Tuyến'}<select required value={relatedId} onChange={(e) => setRelatedId(e.target.value)}><option value="">Chọn</option>{options(related)}</select></label> : null}
          {nppNeeded ? <label>NPP<select required value={nppId} onChange={(e) => setNppId(e.target.value)}><option value="">Chọn</option>{options(data.distributors)}</select></label> : null}
          {sourceNeeded ? <label>{linkKind === 'SKU_ALIAS' ? 'Mã hàng trong tệp NPP' : 'Mã nhân viên trong tệp NPP'}<input required value={rawCode} onChange={(e) => setRawCode(e.target.value)} /></label> : null}
          {ratioNeeded ? <><label>Đơn vị cần quy đổi<input required value={unit} onChange={(e) => setUnit(e.target.value)} /></label>
            <label>Số lượng quy về đơn vị cơ sở<input required min={1} step={1} type="number" value={num} onChange={(e) => setNum(e.target.value)} /></label>
            <label>Cho số lượng đơn vị đang chọn<input required min={1} step={1} type="number" value={den} onChange={(e) => setDen(e.target.value)} /></label><p className="master-conversion-help" role="note">Ví dụ: 1 thùng = 24 lon. Nhập 24 vào ô số lượng quy về đơn vị cơ sở và 1 vào ô số lượng đang chọn. Chỉ nhập tỷ lệ đã xác nhận với NPP.</p></> : null}
          {linkKind !== 'SKU_UNIT' ? <><label>Áp dụng từ ngày<input required type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label>Áp dụng đến hết ngày<input type="date" min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)} /></label></> : null}
          <Button type="submit" appearance="primary" disabled={busy}>Lưu thông tin</Button>
        </form>
        <div className="master-scroll"><table className="master-table"><thead><tr><th>Loại</th><th>Đối tượng</th><th>Người quản lý / NPP</th><th>Mã NPP / Đơn vị tính</th><th>Thời gian áp dụng</th></tr></thead><tbody>
          {history.map((entry) => <tr key={entry.id}><td>{captions[entry.kind]}</td><td>{labelFor(entry.subjectId)}</td>
            <td>{labelFor(entry.relatedId ?? entry.distributorId)}</td><td>{entry.externalCode ?? entry.unitCode ?? '—'}{entry.ratioNum ? ' · ' + entry.ratioNum + '/' + entry.ratioDen : ''}</td>
            <td>{entry.effectiveFrom ?? '—'} → {entry.effectiveTo ?? 'Đang áp dụng'}</td></tr>)}
          {history.length === 0 ? <tr><td colSpan={5}>Chưa có mã NPP hoặc phân công nào.</td></tr> : null}
        </tbody></table></div>
        <form className="master-form" onSubmit={(e) => {
          e.preventDefault(); const entry = history.find((item) => item.id === closeId);
          if (!entry) { setError('Chọn thông tin cần kết thúc áp dụng.'); return; }
          void mutate(async () => { await desktopApi.endMasterLink({ kind: entry.kind, id: entry.id, effectiveTo: closeDate }); setCloseId(''); setCloseDate(''); }, 'Đã lưu ngày kết thúc áp dụng.');
        }}>
          <label>Kết thúc áp dụng<select required value={closeId} onChange={(e) => setCloseId(e.target.value)}><option value="">Chọn thông tin đang áp dụng</option>{
            history.filter((entry) => entry.effectiveFrom && !entry.effectiveTo).map((entry) => <option key={entry.id} value={entry.id}>{captions[entry.kind]} · {labelFor(entry.subjectId)}</option>)}</select></label>
          <label>Áp dụng đến hết ngày<input type="date" required value={closeDate} onChange={(e) => setCloseDate(e.target.value)} /></label>
          <Button type="submit" disabled={busy}>Lưu ngày kết thúc</Button>
        </form>
      </section> : null}
      <p className="master-summary">Doanh số, tồn kho và chỉ tiêu chỉ hiển thị sau khi nhập và kiểm tra dữ liệu từ NPP.</p>
    </> : null}
  </div>;
}
