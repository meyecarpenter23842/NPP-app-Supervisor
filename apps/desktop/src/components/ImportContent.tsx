import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Button } from '@fluentui/react-components';
import { desktopApi, normalizeIpcError, type ImportFileView, type ImportHistory,
  type ImportKind, type ImportPreview, type ImportRequest, type MasterItem } from '../ipc';
import { appearsToBePriceList, fieldsAvailableForColumn, fieldsFor, invalidFixedFields, isTransactionSource, missingFields, pickHeaderRow, SOURCE_ROW_DOCUMENT, suggestColumns } from './importColumnRules';

const kindName: Record<ImportKind, string> = { SALES_IN: 'Sales In (bán vào)', SALES_OUT: 'Sales Out (bán ra)' };
const emptySelection: Record<string, string> = {};
function suggestSalesColumns(headers: string[], kind: ImportKind) {
  const suggested = suggestColumns(headers, kind);
  // Bán/trả for the whole file is selected above. A mixed file requires an explicit opt-in.
  delete suggested.type;
  return suggested;
}
const labelForStatus = (code: string) => code === 'COMMITTED' ? 'Đang sử dụng' : code === 'SUPERSEDED' ? 'Đã thay bằng bản mới' : 'Chưa xác nhận';

export default function ImportContent({ view }: { view: string }) {
  const [npps, setNpps] = useState<MasterItem[]>([]);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [file, setFile] = useState<{ name: string; bytes: number[] } | null>(null);
  const [workbook, setWorkbook] = useState<ImportFileView | null>(null);
  const [sheet, setSheet] = useState('');
  const [columns, setColumns] = useState<Record<string, string>>(emptySelection);
  const [fixedValues, setFixedValues] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<ImportKind>('SALES_OUT');
  const [fileMode, setFileMode] = useState<ImportKind | 'PRICE_SHEET'>('SALES_OUT');
  const [mixedTransactions, setMixedTransactions] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
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
  // Header is the first populated row of the selected sheet. No manual row picker.
  const firstHeader = useMemo(() => pickHeaderRow(active?.firstRows ?? []), [active]);
  const headerRow = firstHeader?.row ?? 1;
  const headers = firstHeader?.values ?? [];
  const selectedColumns = useMemo(() => Object.fromEntries(Object.entries(columns).filter(([,v]) => v !== '')), [columns]);
  const missing = missingFields(kind, selectedColumns, fixedValues);
  const invalidFixed = invalidFixedFields(kind, fixedValues);
  const missingFinancialSource = !isTransactionSource(selectedColumns);
  const invalidFileType = appearsToBePriceList(headers);
  const unmappedRequired = fieldsFor(kind).filter(field => field.required && !columns[field.key]);
  const unmappedOptional = fieldsFor(kind).filter(field =>
    !field.required && field.key !== 'type' && !columns[field.key]);
  useEffect(() => {
    if (!nppId || headers.length === 0) return;
    let current = true;
    desktopApi.getImportMappingProfile(kind, nppId, headers)
      .then(profile => {
        if (!current || !profile) return;
        const defaults = profile.fixedValues ?? {};
        setColumns(Object.fromEntries(Object.entries(profile.columns)
          .filter(([field]) => !defaults[field]?.trim())));
        setFixedValues(defaults);
        setMixedTransactions(Boolean(profile.columns.type));
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
      setSheet(info.sheets[0]?.name ?? '');
      const first = info.sheets[0];
      const titleRow = pickHeaderRow(first?.firstRows ?? []);
      setColumns(suggestSalesColumns(titleRow?.values ?? [], kind));
      setFixedValues({}); setMixedTransactions(false); setShowValidation(false);
      setNotice('Đã đọc tệp. Kiểm tra trường chọn ngay trên mỗi cột Excel.');
    } catch (reason: unknown) { setError(normalizeIpcError(reason).message); }
    finally { setBusy(false); }
  }
  function sourceError(): string {
    if (!nppId) return 'Chọn nhà phân phối ở phần thông tin tệp.';
    if (!from || !to || from > to) return 'Nhập từ ngày và đến ngày hợp lệ ở phần thông tin tệp.';
    if (missing.length) return 'Cần chọn cột hoặc khai báo giá trị chung cho: ' + missing.join(', ');
    if (invalidFixed.length) return 'Giá trị chung chưa hợp lệ: ' + invalidFixed.join(', ');
    if (missingFinancialSource) return 'Để lưu doanh số, cần cột Số lượng bán/giao, hoặc cả cột Số đơn/chứng từ và Thành tiền từ Excel.';
    return '';
  }
  async function doPreview() {
    setShowValidation(true);
    const req = request();
    if (!req) { setError('Chọn tệp Excel hoặc CSV trước.'); return; }
    setBusy(true); setError(''); setNotice(''); setPreview(null);
    try {
      const result = await desktopApi.previewImport(req);
      setPreview(result); setPreviewKey(selectionKey); setReplaceOld(false);
      setNotice(result.preflightOnly
        ? 'Đã đọc tệp. Bổ sung thông tin bên dưới để kiểm tra số liệu bán hàng.'
        : 'Đã kiểm tra các dòng. Xem kết quả trước khi xác nhận lưu.');
    } catch (reason: unknown) { setError(normalizeIpcError(reason).message); }
    finally { setBusy(false); }
  }
  async function saveColumnProfile() {
    const problem = sourceError();
    if (problem) { setError(problem); return; }
    if (headers.length === 0) { setError('Excel không có dòng tên cột hợp lệ.'); return; }
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
    {view === 'Nhập Excel' ? <>
      <section className="content-panel import-panel" aria-label="Chọn tệp dữ liệu">
        <h3>1. Chọn loại dữ liệu, NPP, kỳ và tệp</h3>
        <div className="import-fields">
          <label>Loại dữ liệu<select value={fileMode} onChange={(e) => {
            const value = e.target.value as ImportKind | 'PRICE_SHEET'; setFileMode(value);
            if (value !== 'PRICE_SHEET') {
              setKind(value); setRowKind(value === 'SALES_IN' ? 'INVOICE' : 'DELIVERED');
              setColumns(suggestSalesColumns(headers, value)); setFixedValues({}); setMixedTransactions(false);
            }
            setPreview(null); setShowValidation(false); setError('');
          }}>
            <option value="SALES_OUT">NPP bán ra (Sales Out)</option>
            <option value="SALES_IN">Công ty bán vào NPP (Sales In)</option>
            <option value="PRICE_SHEET">Bảng giá / Danh mục — chỉ xem</option>
          </select></label>
          <label>Nhà phân phối<select value={nppId} required onChange={(e) => { setNppId(e.target.value); setPreview(null); }}><option value="">Chọn NPP</option>{npps.map(npp =>
            <option key={npp.id} value={npp.id}>{npp.code} · {npp.name}</option>)}</select></label>
          <label>Kỳ từ ngày<input type="date" required value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} /></label>
          <label>Đến hết ngày<input type="date" required min={from || undefined} value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }} /></label>
          <label>Tệp Excel hoặc CSV<input type="file" accept=".xlsx,.csv" onChange={(e) => { void onFileChange(e); }} disabled={busy} /></label>
        </div>
        {!workbook ? <p>Chưa chọn tệp. Hỗ trợ Excel .xlsx và CSV UTF-8, tối đa 6 MB.</p> :
          <p><strong>{file?.name}</strong> · {workbook.sheets.length} trang tính · Chọn dữ liệu cho từng cột ngay bên dưới.</p>}
        {npps.length === 0 ? <p>Chưa có NPP đang sử dụng. Hãy tạo NPP ở mục Nhà phân phối trước.</p> : null}
      </section>

    </> : null}
    {view === 'Nhập Excel' ? <section className="content-panel import-panel">
      <h3>2. Xem tệp và chọn dữ liệu theo cột</h3>
      {!workbook ? <p>Chọn tệp Excel/CSV ở phần trên để thấy bảng và gán cột.</p> : <>
        <div className="import-sheet-controls">
          {workbook.sheets.length > 1 ? <label>Trang tính
            <select value={sheet} onChange={(e) => {
              const nextSheet = workbook.sheets.find(item => item.name === e.target.value);
              setSheet(e.target.value);
              setColumns(suggestSalesColumns(pickHeaderRow(nextSheet?.firstRows ?? [])?.values ?? [], kind));
              setFixedValues({}); setPreview(null); setError('');
            }}>
              {workbook.sheets.map(item => <option key={item.name} value={item.name}>{item.name} ({item.rows} dòng)</option>)}
            </select>
          </label> : <p><strong>Trang tính:</strong> {sheet}</p>}
          {fileMode !== 'PRICE_SHEET' ? <>
            <label>Giao dịch trong tệp
              <select value={rowKind} disabled={mixedTransactions}
                onChange={(e) => { setRowKind(e.target.value as typeof rowKind); setPreview(null); }}>
                {kind === 'SALES_OUT' ? <option value="DELIVERED">Bán / giao hàng</option> : <option value="INVOICE">Bán vào NPP</option>}
                <option value="RETURN">Hàng trả lại</option>
              </select>
            </label>
            <label className="import-mixed-option">
              <input type="checkbox" checked={mixedTransactions} onChange={(e) => {
                setMixedTransactions(e.target.checked);
                if (!e.target.checked) setColumns(current => {
                  const next = { ...current }; delete next.type; return next;
                });
                setPreview(null); setError('');
              }}/>
              Có cả bán và trả hàng ở từng dòng Excel
            </label>
          </> : null}
          <span className="import-sheet-info">Tên cột Excel tự lấy từ hàng đầu tiên; không cần chọn dòng tiêu đề.</span>
        </div>
        <p>{fileMode === 'PRICE_SHEET'
          ? 'Đây là chế độ xem tệp. Nhập danh mục và bảng giá chưa được hỗ trợ; không ghi dữ liệu bán hàng.'
          : 'Chọn ý nghĩa của từng cột Excel một lần. Thông tin chung đã nhập sẽ không xuất hiện trong danh sách chọn.'}</p>
        {invalidFileType && fileMode !== 'PRICE_SHEET' ?
          <p className="import-file-hint" role="note">Có cột giá trong tệp. Nếu đây là danh mục/bảng giá, chuyển sang “Bảng giá / Danh mục — chỉ xem”. App không tự kết luận file của anh là sai.</p> : null}
        <div className="import-scroll import-source-table" role="region" aria-label="Bảng Excel và chọn trường chuẩn" tabIndex={0}>
          <table><thead><tr><th className="import-row-number">Dòng Excel</th>{headers.map((h,i) => {
            const position = '@col:' + i;
            const selectedField = Object.keys(columns).find(key => columns[key] === position) ?? '';
            return <th key={i} className="import-source-heading">
              {fileMode !== 'PRICE_SHEET' ? <>
                <label htmlFor={'source-column-' + i}>Cột {i+1}</label>
                <select id={'source-column-' + i}
                  aria-label={'Chọn dữ liệu cho cột ' + (i+1) + ': ' + (h || 'Không có tiêu đề')}
                  value={selectedField} onChange={e => chooseColumn(i,e.target.value)}>
                  <option value="">Không sử dụng</option>
                  {fieldsAvailableForColumn(kind, columns, fixedValues, i, mixedTransactions)
                    .map(f => <option key={f.key} value={f.key}>{f.name}</option>)}
                </select>
              </> : null}
              <span className="import-original-header" title={h || 'Không có tiêu đề'}>{h || 'Cột ' + (i+1) + ' (trống)'}</span>
            </th>;
          })}</tr></thead><tbody>
            {active?.firstRows.filter(x=>x.row>headerRow).slice(0,6).map(x => <tr key={x.row}>
              <th scope="row" className="import-row-number">{x.row}</th>
              {headers.map((_,i)=><td key={i} title={x.values[i] ?? ''}>{x.values[i] ?? ''}</td>)}
            </tr>)}
          </tbody></table>
        </div>
        <p>Hiển thị {headers.length} cột Excel, cuộn ngang nếu cần. Dữ liệu gốc luôn giữ nguyên.</p>
        {fileMode !== 'PRICE_SHEET' && (unmappedRequired.length > 0 || unmappedOptional.length > 0) ? <section className="import-fixed-settings" aria-label="Thông tin chung áp dụng một lần">
          <h4>3. Thông tin giống nhau cho cả tệp</h4>
          <p>Chỉ điền những thông tin giống nhau ở mọi dòng. Nếu dữ liệu mỗi dòng khác nhau, chọn cột Excel phía trên.</p>
          <div className="import-fixed-grid">
            {unmappedRequired.map(field => {
              const value = fixedValues[field.key] ?? '';
              const generated = field.key === 'document' && value === SOURCE_ROW_DOCUMENT;
              return <div key={field.key} className="import-fixed-field">
                <label htmlFor={'fixed-' + field.key}>{field.name} *</label>
                {generated ? <div className="import-fixed-generated">Dùng mã riêng theo từng dòng nguồn</div> :
                  <input id={'fixed-' + field.key} type={field.key === 'date' ? 'date' : 'text'}
                    inputMode={field.key === 'amount' || field.key === 'quantity' ? 'decimal' : 'text'}
                    value={value} onChange={e => {setFixedValues(old => ({...old,[field.key]:e.target.value}));setPreview(null);setError('');}}
                    placeholder={field.key === 'unit' ? 'Ví dụ: THUNG' : field.key === 'document' ? 'Nhập số chứng từ chung' :
                      field.key === 'quantity' ? 'Ví dụ: 1' : field.key === 'amount' ? 'Giá trị VND' : 'Nhập giá trị chung'} />}
                {field.key === 'document' ? <label className="import-inline-checkbox">
                  <input type="checkbox" checked={generated} onChange={e => {
                    setFixedValues(old => ({...old,document:e.target.checked ? SOURCE_ROW_DOCUMENT : ''}));
                    setPreview(null);setError('');
                  }}/> Không có số chứng từ — tạo mã dòng nguồn để truy vết
                </label> : null}
              </div>;
            })}
          </div>
          {unmappedOptional.length > 0 ? <details className="import-optional-common">
            <summary>Thêm thông tin chung khác (nếu có)</summary>
            <div className="import-fixed-grid">
              {unmappedOptional.map(field => <div key={field.key} className="import-fixed-field">
                <label htmlFor={'fixed-' + field.key}>{field.name}</label>
                <input id={'fixed-' + field.key} value={fixedValues[field.key] ?? ''}
                  onChange={e => {setFixedValues(old => ({...old,[field.key]:e.target.value}));setPreview(null);setError('');}}
                  placeholder="Không bắt buộc" />
              </div>)}
            </div>
          </details> : null}
        </section> : null}
        {fileMode !== 'PRICE_SHEET' && columns.type ? <div className="import-fields">
          <label>Giá trị chỉ hàng bán/giao<input value={positive} onChange={(e) => setPositive(e.target.value)} placeholder={kind === 'SALES_IN' ? 'INVOICE' : 'DELIVERED'} /></label>
          <label>Giá trị chỉ hàng trả<input value={returned} onChange={(e) => setReturned(e.target.value)} placeholder="RETURN" /></label>
          <label>Giá trị chỉ hàng hủy<input value={cancelled} onChange={(e) => setCancelled(e.target.value)} placeholder="CANCELLED" /></label>
        </div> : null}
        {active?.hasFormulas ? <p role="note">Tệp có công thức. Những dòng có công thức cần đổi thành giá trị trước khi nhập.</p> : null}
        {fileMode !== 'PRICE_SHEET' ? <>
          {showValidation && (missing.length || invalidFixed.length || missingFinancialSource) ?
            <div className="import-validation-note" role="status">
              {missing.length ? <p>Chưa có: {missing.join(', ')}. Chọn cột Excel hoặc nhập thông tin chung.</p> : null}
              {invalidFixed.length ? <p>Giá trị cần kiểm tra: {invalidFixed.join(', ')}.</p> : null}
              {missingFinancialSource ? <p>Để ghi doanh số cần có cột Số lượng thực bán/giao, hoặc cột Số đơn cùng Thành tiền từ Excel.</p> : null}
            </div> : null}
          <div className="import-actions">
            <Button appearance="secondary" disabled={busy || !file}
              onClick={() => { void saveColumnProfile(); }}>Lưu mẫu chọn cột</Button>
            <Button appearance="primary" disabled={busy || !file} onClick={() => { void doPreview(); }}>
              {busy ? 'Đang kiểm tra…' : 'Xem trước và kiểm tra'}</Button>
          </div>
        </> : <p role="note" className="import-file-hint">Bảng giá và danh mục chỉ được xem trong phiên bản hiện tại. Không có thao tác lưu doanh số từ chế độ này.</p>}
        {fileMode !== 'PRICE_SHEET' ? <p>Mẫu cột đã lưu được tự nạp cho cùng NPP và bố cục Excel.</p> : null}
      </>}
    </section> : null}
    {view === 'Nhập Excel' && fileMode !== 'PRICE_SHEET' && previewReady && preview ? <section className="content-panel import-panel">
      <h3>4. Kiểm tra và xác nhận nhập</h3>
      <>
        {preview.preflightOnly ? <p role="status" className="import-validation-note">Đã xem được tệp. Chưa kiểm tra doanh số vì thông tin nhập còn thiếu hoặc chưa hợp lệ. Không có dữ liệu nào được lưu.</p> : null}
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
        <Button appearance="primary" disabled={busy || preview.preflightOnly || hasErrors || preview.sameFileAlreadyActive || preview.validRows===0 || (preview.hasPrevious&&!replaceOld)}
          onClick={() => {void doCommit();}}>{busy?'Đang lưu…':'Xác nhận nhập dữ liệu chính thức'}</Button>
        <p>Chỉ bấm xác nhận khi mã hàng NPP, đơn vị quy đổi và số liệu đã được kiểm tra. Nhân viên chưa xác định được giữ riêng, không tự phân bổ.</p>
      </>
    </section> : null}
    {view === 'Lịch sử nhập' ? <section className="content-panel import-panel">
        <h3>Lịch sử nhập dữ liệu chính thức</h3>
        <div className="import-scroll"><table><thead><tr><th>Tệp</th><th>NPP</th><th>Loại</th><th>Kỳ</th><th>Dòng đã lưu</th><th>Trạng thái</th></tr></thead><tbody>
          {history.map(h => <tr key={h.id}><td>{h.sourceFileName}</td><td>{h.distributorName}</td>
            <td>{kindName[h.kind]}</td><td>{h.periodFrom} → {h.periodTo}</td><td>{h.validRows}</td><td>{h.active ? 'Đang dùng' : labelForStatus(h.status)}</td></tr>)}
          {!history.length ? <tr><td colSpan={6}>Chưa có lần nhập dữ liệu nào được xác nhận.</td></tr> : null}
        </tbody></table></div>
      </section> : null}
  </div>;
}
