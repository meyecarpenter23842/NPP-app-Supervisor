import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Button } from '@fluentui/react-components';
import { desktopApi, normalizeIpcError, type ImportFileView, type ImportHistory,
  type ImportKind, type ImportPreview, type ImportRequest, type MasterItem } from '../ipc';
import { appearsToBePriceList, fieldsFor, hasSourceFinancialEvidence, invalidFixedFields, missingFields, SOURCE_ROW_DOCUMENT, suggestColumns } from './importColumnRules';

const kindName: Record<ImportKind, string> = { SALES_IN: 'Sales In (bán vào)', SALES_OUT: 'Sales Out (bán ra)' };
const emptySelection: Record<string, string> = {};
const labelForStatus = (code: string) => code === 'COMMITTED' ? 'Đang sử dụng' : code === 'SUPERSEDED' ? 'Đã thay bằng bản mới' : 'Chưa xác nhận';

export default function ImportContent({ view }: { view: string }) {
  const [npps, setNpps] = useState<MasterItem[]>([]);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [file, setFile] = useState<{ name: string; bytes: number[] } | null>(null);
  const [workbook, setWorkbook] = useState<ImportFileView | null>(null);
  const [sheet, setSheet] = useState('');
  const [headerRow, setHeaderRow] = useState(1);
  const [columns, setColumns] = useState<Record<string, string>>(emptySelection);
  const [fixedValues, setFixedValues] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<ImportKind>('SALES_OUT');
  const [nppId, setNppId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rowKind, setRowKind] = useState<'DELIVERED' | 'INVOICE' | 'RETURN'>('DELIVERED');
  const [positive, setPositive] = useState('');
  const [returned, setReturned] = useState('');
  const [cancelled, setCancelled] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewKey, setPreviewKey] = useState('');
  const [replaceOld, setReplaceOld] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadHistory = useCallback(async () => {
    const h = await desktopApi.listImportHistory();
    setHistory(h);
  }, []);
  useEffect(() => {
    let mounted = true;
    Promise.all([desktopApi.listMasterData(), desktopApi.listImportHistory()])
      .then(([m,h]) => { if (mounted) { setNpps(m.distributors.filter(x => x.active)); setHistory(h); } })
      .catch((reason: unknown) => { if (mounted) setError(normalizeIpcError(reason).message); });
    return () => { mounted = false; };
  }, []);
  const active = workbook?.sheets.find(x => x.name === sheet);
  const headers = useMemo(() => active?.firstRows.find(x => x.row === headerRow)?.values ?? [], [active,headerRow]);
  const selectedColumns = useMemo(() => Object.fromEntries(Object.entries(columns).filter(([,v]) => v !== '')), [columns]);
  const missing = missingFields(kind, selectedColumns, fixedValues);
  const invalidFixed = invalidFixedFields(kind, fixedValues);
  const missingFinancialSource = !hasSourceFinancialEvidence(selectedColumns);
  const invalidFileType = appearsToBePriceList(headers);
  useEffect(() => {
    if (!nppId || headers.length === 0) return;
    let current = true;
    desktopApi.getImportMappingProfile(kind, nppId, headers)
      .then(profile => {
        if (!current || !profile) return;
        setColumns(profile.columns);
        setFixedValues(profile.fixedValues ?? {});
        setRowKind(profile.rowKind);
        setPositive(profile.positiveValue ?? '');
        setReturned(profile.returnValue ?? '');
        setCancelled(profile.cancelValue ?? '');
        setNotice('Đã áp dụng mẫu chọn cột từng lưu cho NPP và cấu trúc Excel này.');
        setPreview(null);
      })
      .catch((reason: unknown) => { if (current) setError(normalizeIpcError(reason).message); });
    return () => { current = false; };
  }, [kind, nppId, headers]);
  function chooseSource(field: string, nextValue: string) {
    const selected = nextValue.startsWith('@col:');
    setColumns(old => {
      const next = { ...old };
      delete next[field];
      if (selected && !Object.entries(next).some(([, value]) => value === nextValue)) {
        next[field] = nextValue;
      }
      return next;
    });
    setFixedValues(old => {
      const next = { ...old };
      if (nextValue === '@fixed') next[field] = old[field] === SOURCE_ROW_DOCUMENT ? '' : (old[field] ?? '');
      else if (nextValue === '@generated' && field === 'document') next[field] = SOURCE_ROW_DOCUMENT;
      else delete next[field];
      return next;
    });
    setPreview(null); setError('');
  }
  function chooseColumn(columnIndex: number, field: string) {
    const position = '@col:' + columnIndex;
    setColumns(current => {
      const next = Object.fromEntries(Object.entries(current).filter(([key,value]) => key !== field && value !== position));
      if (field) next[field] = position;
      return next;
    });
    if (field) setFixedValues(current => { const next = { ...current }; delete next[field]; return next; });
    setPreview(null); setError('');
  }
  const selectionKey = JSON.stringify({ fileHash: workbook?.sha256, kind, nppId, from, to, sheet, headerRow, selectedColumns, fixedValues, rowKind, positive, returned, cancelled });
  function request(): ImportRequest | null {
    if (!file) return null;
    return { fileName: file.name, bytes: file.bytes, kind, distributorId: nppId,
      periodFrom: from, periodTo: to, sheetName: sheet, headerRow,
      columns: selectedColumns, fixedValues: Object.fromEntries(Object.entries(fixedValues).filter(([,v]) => v.trim())), rowKind,
      ...(positive ? { positiveValue: positive } : {}),
      ...(returned ? { returnValue: returned } : {}),
      ...(cancelled ? { cancelValue: cancelled } : {}) };
  }
  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    setError(''); setNotice(''); setPreview(null); setPreviewKey(''); setWorkbook(null); setFile(null);
    if (!selected) return;
    if (selected.size > 6 * 1024 * 1024) { setError('Tệp lớn hơn 6 MB. Hãy chọn tệp nhỏ hơn.'); return; }
    setBusy(true);
    try {
      const bytes = Array.from(new Uint8Array(await selected.arrayBuffer()));
      const info = await desktopApi.inspectImportFile(selected.name, bytes);
      setFile({ name: selected.name, bytes }); setWorkbook(info);
      setSheet(info.sheets[0]?.name ?? ''); setHeaderRow(info.sheets[0]?.firstRows[0]?.row ?? 1);
      const first = info.sheets[0];
      const titleRow = first?.firstRows[0];
      setColumns(suggestColumns(titleRow?.values ?? [], kind)); setFixedValues({});
      setNotice('Đã đọc tệp. Kiểm tra trường chọn ngay trên mỗi cột Excel.');
    } catch (reason: unknown) { setError(normalizeIpcError(reason).message); }
    finally { setBusy(false); }
  }
  function sourceError(): string {
    if (!nppId) return 'Hãy chọn nhà phân phối ở bước 1.';
    if (!from || !to || from > to) return 'Hãy chọn kỳ từ ngày / đến hết ngày hợp lệ ở bước 1.';
    if (invalidFileType) return 'Tệp này giống bảng giá, không phải Sales In/Out. Hãy chọn đúng tệp doanh số.';
    if (missing.length) return 'Cần chọn cột hoặc khai báo giá trị chung cho: ' + missing.join(', ');
    if (invalidFixed.length) return 'Giá trị chung chưa hợp lệ: ' + invalidFixed.join(', ');
    if (missingFinancialSource) return 'Ít nhất Số lượng hoặc Doanh số phải lấy từ cột Excel thật; không thể tự tạo toàn bộ số liệu.';
    return '';
  }
  async function doPreview() {
    const problem = sourceError();
    if (problem) { setError(problem); return; }
    const req = request();
    if (!req) { setError('Chọn tệp Excel hoặc CSV trước.'); return; }
    setBusy(true); setError(''); setNotice(''); setPreview(null);
    try {
      const result = await desktopApi.previewImport(req);
      setPreview(result); setPreviewKey(selectionKey); setReplaceOld(false);
      setNotice('Đã kiểm tra tệp. Xem các dòng lỗi trước khi xác nhận nhập.');
    } catch (reason: unknown) { setError(normalizeIpcError(reason).message); }
    finally { setBusy(false); }
  }
  async function saveColumnProfile() {
    const problem = sourceError();
    if (problem) { setError(problem); return; }
    if (headers.length === 0) { setError('Cần chọn dòng tiêu đề Excel.'); return; }
    setBusy(true); setError('');
    try {
      await desktopApi.saveImportMappingProfile({ kind, distributorId: nppId, headers,
        columns: selectedColumns, fixedValues: Object.fromEntries(Object.entries(fixedValues).filter(([,v]) => v.trim())), rowKind,
        positiveValue: positive || null, returnValue: returned || null, cancelValue: cancelled || null });
      setNotice('Đã lưu mẫu chọn cột cho NPP và cấu trúc Excel này.');
    } catch (reason: unknown) { setError(normalizeIpcError(reason).message); }
    finally { setBusy(false); }
  }
  async function doCommit() {
    const req = request();
    if (!req || !preview || previewKey !== selectionKey) { setError('Thông tin đã thay đổi. Hãy xem trước lại.'); return; }
    if (preview.issues.some(x => x.severity === 'ERROR')) { setError('Còn dòng lỗi. Hãy sửa tệp hoặc chọn lại cột trước khi nhập.'); return; }
    if (preview.sameFileAlreadyActive) { setNotice('Tệp này đã được nhập cho NPP và kỳ đã chọn; không nhập trùng.'); return; }
    if (preview.hasPrevious && !replaceOld) { setError('Kỳ này đã có dữ liệu. Hãy chọn thay bản cũ trước khi xác nhận.'); return; }
    if (!window.confirm('Xác nhận lưu ' + preview.validRows + ' dòng ' + kindName[kind] + ' của NPP đã chọn? ' +
      (preview.hasPrevious ? 'Bản dữ liệu cũ sẽ được lưu lịch sử, bản mới thay thế.' : 'Dữ liệu sẽ được sử dụng trong báo cáo.'))) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await desktopApi.commitImport(req, preview.sha256, replaceOld);
      setNotice(saved.alreadyImported ? 'Tệp này đã được nhập, không ghi thêm.' :
        'Đã lưu ' + saved.inserted + ' dòng chính thức.' +
        (saved.unresolved ? ' Có ' + saved.unresolved + ' dòng chưa xác định nhân viên.' : ''));
      await loadHistory();
      setPreview(null); setPreviewKey('');
    } catch (reason: unknown) { setError(normalizeIpcError(reason).message); }
    finally { setBusy(false); }
  }
  const hasErrors = (preview?.errorRows ?? 0) > 0;
  const previewReady = preview && previewKey === selectionKey;
  return <div className="import-workspace">
    <div className="import-lead"><h2>Nhập dữ liệu bán hàng từ NPP</h2>
      <p>Chọn tệp, xác định cột, xem trước kết quả rồi mới xác nhận lưu. Tệp chỉ được xử lý trên máy này.</p></div>
    {error ? <p role="alert" className="master-error">{error}</p> : null}
    {notice ? <p role="status" className="master-success">{notice}</p> : null}
    {view === 'Lần nhập dữ liệu' ? <>
      <section className="content-panel import-panel" aria-label="Chọn tệp dữ liệu">
        <h3>1. Chọn tệp và phạm vi dữ liệu</h3>
        <div className="import-fields">
          <label>Tệp Excel hoặc CSV<input type="file" accept=".xlsx,.csv" onChange={(e) => { void onFileChange(e); }} disabled={busy} /></label>
          <label>Loại dữ liệu<select value={kind} onChange={(e) => {
            const value = e.target.value as ImportKind; setKind(value); setRowKind(value === 'SALES_IN' ? 'INVOICE' : 'DELIVERED');
            setColumns(suggestColumns(headers, value)); setFixedValues({}); setPreview(null);
          }}><option value="SALES_OUT">Sales Out — NPP bán ra</option><option value="SALES_IN">Sales In — Bán vào NPP</option></select></label>
          <label>Nhà phân phối<select value={nppId} required onChange={(e) => { setNppId(e.target.value); setPreview(null); }}><option value="">Chọn NPP</option>{npps.map(npp =>
            <option key={npp.id} value={npp.id}>{npp.code} · {npp.name}</option>)}</select></label>
          <label>Kỳ từ ngày<input type="date" required value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} /></label>
          <label>Đến hết ngày<input type="date" required min={from || undefined} value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }} /></label>
        </div>
        {!workbook ? <p>Chưa chọn tệp. Hỗ trợ Excel .xlsx và CSV UTF-8, tối đa 6 MB.</p> :
          <p><strong>{file?.name}</strong> · {workbook.sheets.length} trang tính · Chọn trang tính ở màn hình “Chọn cột Excel”.</p>}
        {npps.length === 0 ? <p>Chưa có NPP đang sử dụng. Hãy tạo NPP ở mục Nhà phân phối trước.</p> : null}
      </section>
      <section className="content-panel import-panel">
        <h3>Lịch sử nhập dữ liệu chính thức</h3>
        <div className="import-scroll"><table><thead><tr><th>Tệp</th><th>NPP</th><th>Loại</th><th>Kỳ</th><th>Dòng đã lưu</th><th>Trạng thái</th></tr></thead><tbody>
          {history.map(h => <tr key={h.id}><td>{h.sourceFileName}</td><td>{h.distributorName}</td>
            <td>{kindName[h.kind]}</td><td>{h.periodFrom} → {h.periodTo}</td><td>{h.validRows}</td><td>{h.active ? 'Đang dùng' : labelForStatus(h.status)}</td></tr>)}
          {!history.length ? <tr><td colSpan={6}>Chưa có lần nhập dữ liệu nào được xác nhận.</td></tr> : null}
        </tbody></table></div>
      </section>
    </> : null}
    {view === 'Chọn cột Excel' ? <section className="content-panel import-panel">
      <h3>2. Chọn trang tính và cột dữ liệu</h3>
      {!workbook ? <p>Chưa chọn tệp. Hãy chọn tệp ở màn hình “Lần nhập dữ liệu” trước.</p> : <>
        <div className="import-fields">
          <label>Trang tính<select value={sheet} onChange={(e) => {
            const nextSheet = workbook.sheets.find(s => s.name === e.target.value);
            setSheet(e.target.value); setHeaderRow(nextSheet?.firstRows[0]?.row ?? 1);
            setColumns(suggestColumns(nextSheet?.firstRows[0]?.values ?? [], kind)); setFixedValues({}); setPreview(null);
          }}>
            {workbook.sheets.map(s => <option key={s.name} value={s.name}>{s.name} ({s.rows} dòng)</option>)}</select></label>
          <label>Dòng tiêu đề<select value={headerRow} onChange={(e) => {
            const row = Number(e.target.value); setHeaderRow(row);
            setColumns(suggestColumns(active?.firstRows.find(x => x.row === row)?.values ?? [], kind)); setFixedValues({}); setPreview(null);
          }}>
            {active?.firstRows.map(x => <option key={x.row} value={x.row}>Dòng {x.row}: {x.values.slice(0,3).join(' | ')}</option>)}</select></label>
          <label>Loại chứng từ của tệp<select value={rowKind} onChange={(e) => setRowKind(e.target.value as typeof rowKind)}>
            {kind === 'SALES_OUT' ? <option value="DELIVERED">Đã giao hàng</option> : <option value="INVOICE">Đã bán vào NPP</option>}
            <option value="RETURN">Hàng trả lại</option></select></label>
        </div>
        <p>Trường nào có trong Excel thì chọn ngay trên đầu cột. Nếu một thông tin giống nhau ở mọi dòng, chọn “Giá trị chung cho tệp” bên dưới. Không cần thêm cột giả vào Excel.</p>
        {invalidFileType ? <p role="alert" className="import-field-warning">Tệp có dấu hiệu là bảng giá, không phải doanh số. Không được nhập nhầm thành Sales Out.</p> : null}
        {missing.length ? <p role="status" className="import-field-warning"><strong>Cần chọn cột hoặc giá trị chung:</strong> {missing.join(' · ')}</p> :
          <p role="status" className="import-field-ready">Đã khai báo đủ các trường bắt buộc.</p>}
        {missingFinancialSource ? <p role="status" className="import-field-warning">Số lượng hoặc Doanh số phải có ít nhất một cột dữ liệu thực trong Excel.</p> : null}
        {invalidFixed.length ? <p role="status" className="import-field-warning">Giá trị chung không hợp lệ: {invalidFixed.join(' · ')}</p> : null}
        <div className="import-scroll import-source-table" role="region" aria-label="Bảng Excel và chọn trường chuẩn" tabIndex={0}>
          <table><thead><tr><th className="import-row-number">Dòng Excel</th>{headers.map((h,i) => {
            const position = '@col:' + i;
            const selectedField = Object.keys(columns).find(key => columns[key] === position) ?? '';
            return <th key={i} className="import-source-heading">
              <label htmlFor={'source-column-' + i}>Trường dữ liệu cột {i+1}</label>
              <select id={'source-column-' + i} aria-label={'Chọn trường chuẩn cho cột ' + (i+1) + ': ' + (h || 'Không có tiêu đề')}
                value={selectedField} onChange={e => chooseColumn(i,e.target.value)}>
                <option value="">Không sử dụng</option>
                {fieldsFor(kind).map(f => <option key={f.key} value={f.key}
                  disabled={Boolean(columns[f.key]) && columns[f.key] !== position}>{f.name}{f.required ? ' *' : ''}</option>)}
              </select>
              <span className="import-original-header" title={h || 'Không có tiêu đề'}>{h || 'Cột ' + (i+1) + ' (trống)'}</span>
            </th>;
          })}</tr></thead><tbody>
            {active?.firstRows.filter(x=>x.row>headerRow).slice(0,6).map(x => <tr key={x.row}>
              <th scope="row" className="import-row-number">{x.row}</th>
              {headers.map((_,i)=><td key={i} title={x.values[i] ?? ''}>{x.values[i] ?? ''}</td>)}
            </tr>)}
          </tbody></table>
        </div>
        <p>Cuộn ngang để xem toàn bộ {headers.length} cột nguồn; tên cột gốc và dữ liệu mẫu nằm ngay dưới dropdown.</p>
        <section className="import-fixed-settings" aria-label="Nguồn dữ liệu cho từng trường">
          <h4>Trường dữ liệu: cột Excel hoặc giá trị chung</h4>
          <p>Giá trị chung chỉ áp dụng khi toàn bộ các dòng của tệp thực sự có cùng thông tin. Mã dòng nguồn là mã kỹ thuật để truy vết, không phải số hóa đơn.</p>
          <div className="import-fixed-grid">
            {fieldsFor(kind).map(field => {
              const col = columns[field.key] ?? '';
              const fixed = fixedValues[field.key];
              const mode = col || (fixed === SOURCE_ROW_DOCUMENT ? '@generated' : fixed !== undefined ? '@fixed' : '');
              return <div key={field.key} className="import-fixed-field">
                <label htmlFor={'source-value-' + field.key}>{field.name}{field.required ? ' *' : ''}</label>
                <select id={'source-value-' + field.key} value={mode}
                  onChange={e => chooseSource(field.key, e.target.value)}>
                  <option value="">Không sử dụng / Chưa chọn</option>
                  {headers.map((h, i) => {
                    const position = '@col:' + i;
                    return <option key={i} value={position}
                      disabled={Object.entries(columns).some(([key, source]) => key !== field.key && source === position)}>
                      {'Cột ' + (i+1) + ' · ' + (h || '(trống)')}</option>;
                  })}
                  {field.key !== 'type' ? <option value="@fixed">Giá trị chung cho cả tệp</option> : null}
                  {field.key === 'document' ? <option value="@generated">Tạo mã riêng theo dòng nguồn</option> : null}
                </select>
                {mode === '@fixed' ? <input
                  aria-label={'Giá trị chung: ' + field.name}
                  type={field.key === 'date' ? 'date' : 'text'}
                  inputMode={field.key === 'quantity' || field.key === 'amount' ? 'decimal' : 'text'}
                  placeholder={field.key === 'quantity' ? 'Ví dụ: 1' : field.key === 'amount' ? 'VND nguyên, không dấu phân cách' : 'Nhập giá trị áp dụng cho mọi dòng'}
                  value={fixed ?? ''}
                  onChange={e => { setFixedValues(old => ({ ...old, [field.key]: e.target.value })); setPreview(null); setError(''); }}
                /> : null}
                {mode === '@generated' ? <small>Mỗi dòng Excel có mã nguồn riêng; không coi là số chứng từ NPP.</small> : null}
              </div>;
            })}
          </div>
        </section>
        {columns.type ? <div className="import-fields">
          <label>Giá trị chỉ hàng bán/giao<input value={positive} onChange={(e) => setPositive(e.target.value)} placeholder={kind === 'SALES_IN' ? 'INVOICE' : 'DELIVERED'} /></label>
          <label>Giá trị chỉ hàng trả<input value={returned} onChange={(e) => setReturned(e.target.value)} placeholder="RETURN" /></label>
          <label>Giá trị chỉ hàng hủy<input value={cancelled} onChange={(e) => setCancelled(e.target.value)} placeholder="CANCELLED" /></label>
        </div> : null}
        {active?.hasFormulas ? <p role="note">Tệp có công thức. Những dòng có công thức cần đổi thành giá trị trước khi nhập.</p> : null}
        <div className="import-actions">
          <Button appearance="secondary" disabled={busy || !file}
            onClick={() => { void saveColumnProfile(); }}>Lưu mẫu chọn cột</Button>
          <Button appearance="primary" disabled={busy || !file} onClick={() => { void doPreview(); }}>
          {busy ? 'Đang kiểm tra…' : 'Xem trước và kiểm tra dữ liệu'}</Button>
        </div>
        <p>Mẫu đã lưu sẽ tự được đề xuất khi nhập lại tệp cùng NPP, loại dữ liệu và cấu trúc cột, kể cả sau khi mở lại ứng dụng.</p>
      </>}
    </section> : null}
    {view === 'Dòng cần kiểm tra' ? <section className="content-panel import-panel">
      <h3>3. Kiểm tra và xác nhận nhập</h3>
      {!previewReady ? <p>Chưa có kết quả xem trước, hoặc thông tin đã thay đổi. Vào “Chọn cột Excel” và bấm “Xem trước”.</p> : <>
        <div className="import-stats"><span>Tổng dòng: <strong>{preview.totalRows}</strong></span><span>Hợp lệ: <strong>{preview.validRows}</strong></span>
          <span>Bỏ qua: <strong>{preview.skippedRows}</strong></span><span>Cần sửa: <strong>{preview.errorRows}</strong></span><span>Chưa xác định nhân viên: <strong>{preview.unknownEmployees}</strong></span></div>
        {preview.issues.length>0 ? <div className="import-scroll"><table><thead><tr><th>Dòng</th><th>Cột</th><th>Mức độ</th><th>Lý do / cách xử lý</th></tr></thead><tbody>
          {preview.issues.map((item,i) => <tr key={i}><td>{item.row}</td><td>{item.column}</td>
            <td>{item.severity==='ERROR'?'Cần sửa':'Cần kiểm tra'}</td><td>{item.message}</td></tr>)}
        </tbody></table></div> : <p>Không phát hiện lỗi trong các dòng dữ liệu đã kiểm tra.</p>}
        {preview.hasPrevious && !preview.sameFileAlreadyActive ? <label className="import-confirm">
          <input type="checkbox" checked={replaceOld} onChange={e=>setReplaceOld(e.target.checked)} />
          Tôi xác nhận thay dữ liệu cũ cùng NPP và kỳ đã chọn. Bản cũ được giữ trong lịch sử.
        </label> : null}
        {preview.sameFileAlreadyActive ? <p>Tệp đã được nhập cho kỳ này. Không cần nhập thêm.</p> : null}
        <Button appearance="primary" disabled={busy || hasErrors || preview.sameFileAlreadyActive || preview.validRows===0 || (preview.hasPrevious&&!replaceOld)}
          onClick={() => {void doCommit();}}>{busy?'Đang lưu…':'Xác nhận nhập dữ liệu chính thức'}</Button>
        <p>Chỉ bấm xác nhận khi mã hàng NPP, đơn vị quy đổi và số liệu đã được kiểm tra. Nhân viên chưa xác định được giữ riêng, không tự phân bổ.</p>
      </>}
    </section> : null}
  </div>;
}
