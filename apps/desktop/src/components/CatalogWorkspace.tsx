import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  desktopApi, normalizeIpcError,
  type CatalogSnapshot, type CatalogOptionKind, type CatalogImportKind,
  type CatalogImportRequest, type CatalogBatchPreview, type CatalogImportHistory,
  type ImportFileView, type MasterSnapshot, type SkuMetric,
} from '../ipc';

const emptyMaster: MasterSnapshot = { distributors: [], families: [], skus: [], employees: [], routes: [], links: [] };
const emptyCatalog: CatalogSnapshot = { categories: [], brands: [], units: [], priceLists: [], priceItems: [] };
const importedKinds: Record<CatalogImportKind, { title: string; fields: readonly { key: string; label: string; required?: boolean }[] }> = {
  CATEGORY: { title: 'Nhóm hàng', fields: [{ key: 'code', label: 'Mã nhóm', required: true }, { key: 'name', label: 'Tên nhóm', required: true }] },
  BRAND: { title: 'Nhãn hàng', fields: [{ key: 'code', label: 'Mã nhãn hàng', required: true }, { key: 'name', label: 'Tên nhãn hàng', required: true }] },
  UNIT_CATALOG: { title: 'Đơn vị tính', fields: [{ key: 'code', label: 'Mã đơn vị', required: true }, { key: 'name', label: 'Tên đơn vị', required: true }] },
  FAMILY: { title: 'Sản phẩm', fields: [
    { key: 'code', label: 'Mã sản phẩm', required: true }, { key: 'name', label: 'Tên sản phẩm', required: true },
    { key: 'categoryCode', label: 'Mã nhóm hàng' }, { key: 'brandCode', label: 'Mã nhãn hàng' },
  ] },
  SKU: { title: 'SKU', fields: [
    { key: 'code', label: 'Mã SKU chuẩn', required: true }, { key: 'name', label: 'Tên SKU', required: true },
    { key: 'familyCode', label: 'Mã sản phẩm cha', required: true }, { key: 'unitCode', label: 'Đơn vị cơ sở', required: true },
  ] },
  CONVERSION: { title: 'Quy đổi đơn vị', fields: [
    { key: 'skuCode', label: 'Mã SKU chuẩn', required: true }, { key: 'unitCode', label: 'Đơn vị', required: true },
    { key: 'ratioNum', label: 'Số lượng quy đổi', required: true }, { key: 'ratioDen', label: 'Đơn vị chia', required: true },
  ] },
  ALIAS: { title: 'Mã hàng NPP', fields: [
    { key: 'skuCode', label: 'Mã SKU chuẩn', required: true }, { key: 'distributorCode', label: 'Mã NPP' },
    { key: 'rawCode', label: 'Mã hàng tại NPP', required: true }, { key: 'unitCode', label: 'Đơn vị', required: true },
    { key: 'ratioNum', label: 'Số lượng quy đổi', required: true }, { key: 'ratioDen', label: 'Đơn vị chia', required: true },
    { key: 'from', label: 'Áp dụng từ', required: true }, { key: 'to', label: 'Đến ngày' },
  ] },
  PRICE: { title: 'Bảng giá', fields: [
    { key: 'priceListCode', label: 'Mã bảng giá' }, { key: 'distributorCode', label: 'Mã NPP' },
    { key: 'skuCode', label: 'Mã SKU chuẩn', required: true }, { key: 'unitCode', label: 'Đơn vị giá', required: true },
    { key: 'amountVnd', label: 'Giá (VND)', required: true },
    { key: 'from', label: 'Áp dụng từ', required: true }, { key: 'to', label: 'Đến ngày' },
  ] },
};
const kindLabels: Record<CatalogOptionKind, string> = { CATEGORY: 'Nhóm hàng', BRAND: 'Nhãn hàng', UNIT: 'Đơn vị tính' };
const emptyMessage = 'Chưa có dữ liệu. Hãy thiết lập thủ công hoặc nhập Excel ngay trong phần này.';
const caption: Record<string, string> = {
  ADDED: 'Thêm mới', UNCHANGED: 'Đã có', ERROR: 'Cần xử lý',
};
function ErrorLine({ error, notice }: { error: string; notice: string }) {
  return <>{error ? <p role="alert" className="catalog-error">{error}</p> : null}
    {notice ? <p role="status" className="catalog-notice">{notice}</p> : null}</>;
}

function CatalogExcel({ master, catalog, onChange }: {
  master: MasterSnapshot; catalog: CatalogSnapshot; onChange: () => Promise<void>;
}) {
  const [kind, setKind] = useState<CatalogImportKind>('PRICE');
  const [nppId, setNppId] = useState('');
  const [priceListId, setPriceListId] = useState('');
  const [chosen, setChosen] = useState<{ fileName: string; bytes: number[] } | null>(null);
  const [workbook, setWorkbook] = useState<ImportFileView | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [headerRow, setHeaderRow] = useState(1);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [fixed, setFixed] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<CatalogBatchPreview | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [history, setHistory] = useState<CatalogImportHistory[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { desktopApi.listCatalogImportHistory().then(setHistory).catch(() => setError('Không đọc được lịch sử nhập danh mục.')); }, []);
  const scopeNpp = nppId || master.distributors[0]?.id || '';
  const lists = catalog.priceLists.filter(p => p.distributorId === scopeNpp);
  const scopeList = priceListId || lists[0]?.id || '';
  const sheet = workbook?.sheets.find(s => s.name === sheetName);
  const firstRows = sheet?.firstRows ?? [];
  const header = firstRows.find(r => r.row === headerRow) ?? firstRows[0];
  const fields = importedKinds[kind].fields;
  const mapped = useMemo(() => Object.fromEntries(
    Object.entries(picked).filter(([, v]) => !!v).map(([index, field]) => [field, Number(index)]),
  ), [picked]);
  const required = fields.filter(f => f.required && mapped[f.key] === undefined && !fixed[f.key]?.trim());
  const refreshSelection = () => { setPreview(null); setPreviewPage(0); setError(''); setNotice(''); };
  function request(): CatalogImportRequest | null {
    if (!chosen || !sheet || !header) { setError('Hãy chọn tệp và trang dữ liệu.'); return null; }
    if (required.length) { setError('Chưa chọn: ' + required.map(f => f.label).join(', ')); return null; }
    if ((kind === 'ALIAS' || kind === 'PRICE') && !scopeNpp && mapped.distributorCode === undefined) {
      setError('Cần chọn nhà phân phối hoặc cột mã NPP.'); return null;
    }
    if (kind === 'PRICE' && !scopeList && mapped.priceListCode === undefined) {
      setError('Cần tạo hoặc chọn bảng giá trước khi nhập dòng giá.'); return null;
    }
    return { fileName: chosen.fileName, bytes: chosen.bytes, sheetName: sheet.name,
      headerRow: header.row, kind, columns: mapped, fixedValues: fixed,
      distributorId: mapped.distributorCode === undefined ? (scopeNpp || null) : null,
      priceListId: mapped.priceListCode === undefined ? (scopeList || null) : null };
  }
  async function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setChosen(null); setWorkbook(null); setPicked({}); setPreview(null); setError(''); setNotice('');
    if (!file) return;
    setBusy(true);
    try {
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      const result = await desktopApi.inspectImportFile(file.name, bytes);
      setChosen({ fileName: file.name, bytes }); setWorkbook(result);
      const first = result.sheets[0];
      setSheetName(first?.name ?? ''); setHeaderRow(first?.firstRows[0]?.row ?? 1);
      if (first?.hasFormulas) setError('Trang dữ liệu có công thức. Cần lưu bản chỉ chứa giá trị.');
    } catch (reason) { setError(normalizeIpcError(reason).message); }
    finally { setBusy(false); }
  }
  async function doPreview() {
    const req = request(); if (!req) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const checked = await desktopApi.previewCatalogImport(req);
      setPreview(checked); setPreviewPage(0);
      if (checked.errorRows) setError(checked.errorRows + ' dòng cần xử lý; dữ liệu chưa được ghi.');
      else if (checked.alreadyImported) setNotice('Tệp này đã nhập với cùng cách chọn cột, không ghi lại.');
      else setNotice('Xem trước thành công. Chưa ghi dữ liệu lên máy.');
    } catch (reason) { setPreview(null); setError(normalizeIpcError(reason).message); }
    finally { setBusy(false); }
  }
  async function doCommit() {
    const req = request(); if (!req || !preview || preview.errorRows || preview.alreadyImported) return;
    setBusy(true); setError('');
    try {
      const result = await desktopApi.commitCatalogImport(req, preview.fingerprint);
      setNotice(result.alreadyImported ? 'Tệp này đã được nhập.' :
        'Đã lưu ' + result.insertedRows + ' dòng; ' + result.unchangedRows + ' dòng không đổi.');
      setHistory(await desktopApi.listCatalogImportHistory());
      setPreview(null);
      await onChange();
    } catch (reason) { setError(normalizeIpcError(reason).message); }
    finally { setBusy(false); }
  }
  return <div className="catalog-excel">
    <section className="content-panel catalog-panel">
      <h2>Nhập Excel danh mục và bảng giá</h2>
      <p>Chọn loại dữ liệu, gán trường chuẩn ngay trên mỗi cột, xem trước rồi mới xác nhận. Tệp bán hàng không được nhập làm bảng giá.</p>
      <div className="catalog-form-grid">
        <label>Loại dữ liệu<select value={kind} onChange={e => { setKind(e.target.value as CatalogImportKind); setPicked({}); setFixed({}); refreshSelection(); }}>
          {Object.entries(importedKinds).map(([key, meta]) => <option key={key} value={key}>{meta.title}</option>)}
        </select></label>
        {(kind === 'PRICE' || kind === 'ALIAS') ? <label>Nhà phân phối<select value={scopeNpp} onChange={e => { setNppId(e.target.value); setPriceListId(''); refreshSelection(); }}>
          <option value="">Chọn NPP</option>{master.distributors.map(x => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}
        </select></label> : null}
        {kind === 'PRICE' ? <label>Bảng giá đã tạo<select value={scopeList} onChange={e => { setPriceListId(e.target.value); refreshSelection(); }}>
          <option value="">Chọn bảng giá</option>{lists.map(x => <option key={x.id} value={x.id}>{x.code} · {x.name} ({x.priceType})</option>)}
        </select></label> : null}
        <label>Chọn tệp .xlsx hoặc .csv<input type="file" accept=".xlsx,.csv" onChange={chooseFile} /></label>
      </div>
      {chosen ? <p className="catalog-small">Tệp: <strong>{chosen.fileName}</strong></p> : null}
      {workbook ? <div className="catalog-form-grid">
        <label>Trang dữ liệu<select value={sheetName} onChange={e => {
          const next = workbook.sheets.find(s => s.name === e.target.value);
          setSheetName(e.target.value); setHeaderRow(next?.firstRows[0]?.row ?? 1);
          setPicked({}); refreshSelection();
        }}>{workbook.sheets.map(x => <option key={x.name}>{x.name}</option>)}</select></label>
        <label>Dòng tiêu đề<select value={headerRow} onChange={e => { setHeaderRow(Number(e.target.value)); setPicked({}); refreshSelection(); }}>
          {firstRows.slice(0, 12).map(x => <option key={x.row} value={x.row}>Dòng {x.row}: {x.values.slice(0, 3).join(' | ')}</option>)}
        </select></label>
      </div> : null}
      {header ? <>
        <div className="catalog-excel-scroll" role="region" aria-label="Dữ liệu Excel và chọn trường" tabIndex={0}>
          <table className="catalog-table"><thead><tr><th scope="col">Dòng</th>{header.values.map((heading, i) => <th key={i} scope="col">
            <label>Trường cột {i + 1}<select aria-label={'Trường cho cột ' + (i + 1)}
              value={picked[i] ?? ''} onChange={e => {
                const next = { ...picked, [i]: e.target.value };
                for (const [index, value] of Object.entries(next)) if (Number(index) !== i && value && value === e.target.value) next[Number(index)] = '';
                setPicked(next); refreshSelection();
              }}><option value="">Không nhập</option>{fields.map(f => <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>)}
            </select></label><small title={heading}>{heading || 'Cột trống'}</small>
          </th>)}</tr></thead><tbody>{firstRows.filter(x => x.row > header.row).slice(0, 6).map(row =>
            <tr key={row.row}><th scope="row">{row.row}</th>{header.values.map((_, i) => <td key={i}>{row.values[i] ?? ''}</td>)}</tr>)}</tbody></table>
        </div>
        <details className="catalog-common"><summary>Giá trị dùng chung nếu tệp thiếu cột</summary>
          <div className="catalog-form-grid">{fields.filter(f => mapped[f.key] === undefined).map(f => <label key={f.key}>{f.label}{f.required ? ' *' : ''}
            <input value={fixed[f.key] ?? ''} onChange={e => { setFixed(s => ({ ...s, [f.key]: e.target.value })); refreshSelection(); }} />
          </label>)}</div>
        </details>
        <p className="catalog-small">* Trường bắt buộc. Mã có số 0 đầu được giữ nguyên; số tiền phải là VND nguyên. Giá xung đột sẽ bị chặn.</p>
        <div className="catalog-actions"><button type="button" disabled={busy} onClick={doPreview}>Kiểm tra và xem trước</button>
          <button type="button" className="catalog-primary" disabled={busy || !preview || preview.errorRows > 0 || preview.alreadyImported} onClick={doCommit}>Xác nhận nhập dữ liệu</button></div>
      </> : null}
      <ErrorLine error={error} notice={notice} />
    </section>
    {preview ? <section className="content-panel catalog-panel">
      <h2>Kết quả kiểm tra — chưa ghi</h2>
      <div className="catalog-stats"><span>Tổng: <strong>{preview.totalRows}</strong></span>
        <span>Thêm mới: <strong>{preview.insertedRows}</strong></span>
        <span>Đã có: <strong>{preview.unchangedRows}</strong></span>
        <span>Cần xử lý: <strong>{preview.errorRows}</strong></span></div>
      {preview.issues.length > 0 && <div className="catalog-excel-scroll"><table className="catalog-table"><thead><tr><th>Dòng</th><th>Trạng thái</th><th>Lý do</th></tr></thead>
        <tbody>{preview.issues.map(x => <tr key={x.row}><td>{x.row}</td><td>{caption[x.status]}</td><td>{x.message}</td></tr>)}</tbody></table></div>}
      {preview.sample.length ? <>
        <h3>Trạng thái từng dòng</h3>
        <div className="catalog-actions">
          <button type="button" disabled={previewPage === 0} onClick={() => setPreviewPage(n => Math.max(0, n - 1))}>Trang trước</button>
          <span role="status">Trang {previewPage + 1} / {Math.ceil(preview.sample.length / 50)}</span>
          <button type="button" disabled={(previewPage + 1) * 50 >= preview.sample.length} onClick={() => setPreviewPage(n => n + 1)}>Trang sau</button>
        </div>
        <div className="catalog-excel-scroll" role="region" aria-label="Trạng thái các dòng Excel" tabIndex={0}>
          <table className="catalog-table"><thead><tr><th scope="col">Dòng Excel</th><th scope="col">Kết quả</th><th scope="col">Chi tiết</th></tr></thead>
            <tbody>{preview.sample.slice(previewPage * 50, (previewPage + 1) * 50).map(x =>
              <tr key={x.row}><th scope="row">{x.row}</th><td>{caption[x.status]}</td><td>{x.message}</td></tr>)}</tbody>
          </table>
        </div>
      </> : null}
      {preview.issues.length === 0 ? <p>Đã kiểm tra các dòng trong tệp. Chỉ khi xác nhận, dữ liệu mới được lưu vào danh mục và bảng giá hiện có.</p> : null}
    </section> : null}
    <section className="content-panel catalog-panel">
      <h2>Lịch sử nhập danh mục</h2>
      {history.length ? <div className="catalog-excel-scroll"><table className="catalog-table">
        <thead><tr><th>Thời gian</th><th>Loại</th><th>Tệp / trang</th><th>Dòng</th><th>Thêm mới</th><th>Không đổi</th></tr></thead>
        <tbody>{history.map(x => <tr key={x.id}><td>{x.createdAtUtc}</td><td>{importedKinds[x.kind]?.title ?? x.kind}</td>
          <td>{x.sourceFileName} / {x.sourceSheet}</td><td>{x.totalRows}</td><td>{x.insertedRows}</td><td>{x.unchangedRows}</td></tr>)}</tbody>
      </table></div> : <p>{emptyMessage}</p>}
    </section>
  </div>;
}

export default function CatalogWorkspace({ view }: { view: string }) {
  const [master, setMaster] = useState<MasterSnapshot>(emptyMaster);
  const [metrics, setMetrics] = useState<SkuMetric[]>([]);
  const [catalog, setCatalog] = useState<CatalogSnapshot>(emptyCatalog);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [skuId, setSkuId] = useState('');
  const [nppId, setNppId] = useState('');
  const [listId, setListId] = useState('');
  const [optionKind, setOptionKind] = useState<CatalogOptionKind>('CATEGORY');
  const [optionCode, setOptionCode] = useState(''); const [optionName, setOptionName] = useState('');
  const [familyCode, setFamilyCode] = useState(''); const [familyName, setFamilyName] = useState('');
  const [categoryId, setCategoryId] = useState(''); const [brandId, setBrandId] = useState('');
  const [skuCode, setSkuCode] = useState(''); const [skuName, setSkuName] = useState(''); const [skuUnit, setSkuUnit] = useState('');
  const [unitCode, setUnitCode] = useState(''); const [ratioNum, setRatioNum] = useState('1'); const [ratioDen, setRatioDen] = useState('1');
  const [aliasUnitCode, setAliasUnitCode] = useState(''); const [priceUnitCode, setPriceUnitCode] = useState('');
  const [rawCode, setRawCode] = useState(''); const [aliasFrom, setAliasFrom] = useState(''); const [aliasTo, setAliasTo] = useState('');
  const [listCode, setListCode] = useState(''); const [listName, setListName] = useState(''); const [priceType, setPriceType] = useState('');
  const [listFrom, setListFrom] = useState(''); const [listTo, setListTo] = useState('');
  const [amount, setAmount] = useState(''); const [priceFrom, setPriceFrom] = useState(''); const [priceTo, setPriceTo] = useState('');
  const [closeId, setCloseId] = useState(''); const [closeDate, setCloseDate] = useState('');
  const [editName, setEditName] = useState('');
  const load = useCallback(async () => {
    const [m, c, actual] = await Promise.all([desktopApi.listMasterData(), desktopApi.listCatalog(), view === 'Phân tích SKU' ? desktopApi.listSkuMetrics() : Promise.resolve([])]);
    setMaster(m); setCatalog(c); setMetrics(actual);
    setFamilyId(prev => m.families.some(f => f.id === prev) ? prev : (m.families[0]?.id ?? ''));
    setSkuId(prev => m.skus.some(f => f.id === prev) ? prev : '');
    setEditName(prev => prev || m.families[0]?.name || '');
    setNppId(prev => m.distributors.some(f => f.id === prev) ? prev : (m.distributors[0]?.id ?? ''));
    setListId(prev => c.priceLists.some(p => p.id === prev) ? prev : (c.priceLists[0]?.id ?? ''));
  }, [view]);
  useEffect(() => { let live = true; load().catch(reason => { if (live) setError(normalizeIpcError(reason).message); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [load]);
  async function mutate(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await load(); setNotice(message); }
    catch (reason) { setError(normalizeIpcError(reason).message); }
    finally { setBusy(false); }
  }
  const family = master.families.find(x => x.id === familyId);
  const selectedNpp = nppId || master.distributors[0]?.id || '';
  const activeLists = catalog.priceLists.filter(x => x.distributorId === selectedNpp);
  const selectedList = activeLists.some(x => x.id === listId) ? listId : (activeLists[0]?.id ?? '');
  const familySkus = master.skus.filter(x => x.parentId === familyId);
  const registeredUnits = master.links.filter(x => x.kind === 'SKU_UNIT' && x.subjectId === skuId);
  const aliasUnit = registeredUnits.find(x => x.unitCode === aliasUnitCode);
  const priceUnit = registeredUnits.find(x => x.unitCode === priceUnitCode);
  const skuAliases = master.links.filter(x => x.kind === 'SKU_ALIAS' && x.subjectId === skuId);
  const priceRows = catalog.priceItems.filter(x => x.priceListId === selectedList);
  const searchMatch = master.families.filter(x =>
    [x.code, x.name].some(v => v.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))));
  const selectFamily = (id: string) => { setFamilyId(id); const first=master.skus.find(x => x.parentId === id);
    setSkuId(first?.id ?? ''); setAliasUnitCode(''); setPriceUnitCode('');
    setEditName(master.families.find(x => x.id === id)?.name ?? ''); };
  function addFamily(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); void mutate(async () => {
      const created = await desktopApi.createProductFamily({
        code: familyCode, name: familyName, categoryId: categoryId || null, brandId: brandId || null,
      });
      setFamilyId(created.id); setSkuId(''); setAliasUnitCode(''); setPriceUnitCode('');
       setEditName(familyName); setFamilyCode(''); setFamilyName('');
    }, 'Đã lưu sản phẩm chuẩn.');
  }
  function addSku(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!familyId) {setError('Cần chọn sản phẩm trước.'); return;}
    void mutate(async () => {
      const created=await desktopApi.createMasterItem({ kind: 'SKU', code: skuCode, name: skuName, parentId: familyId, detail: skuUnit });
      setSkuId(created.id); setAliasUnitCode(''); setPriceUnitCode(''); setSkuCode(''); setSkuName('');
    }, 'Đã lưu SKU và đơn vị cơ sở.');
  }
  function addOption(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); void mutate(async () => {
      await desktopApi.createCatalogOption({ kind: optionKind, code: optionCode, name: optionName });
      setOptionCode(''); setOptionName('');
    }, 'Đã lưu ' + kindLabels[optionKind].toLocaleLowerCase('vi') + '.');
  }
  function addUnit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!skuId) {setError('Chọn SKU trước.'); return;}
    void mutate(async () => {
      await desktopApi.createMasterLink({ kind: 'SKU_UNIT', subjectId: skuId, unitCode,
        ratioNum: Number(ratioNum), ratioDen: Number(ratioDen) });
      setUnitCode(''); setRatioNum('1'); setRatioDen('1');
    }, 'Đã lưu đơn vị và tỷ lệ quy đổi.');
  }
  function addAlias(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const unit = aliasUnit;
    if (!unit || !skuId || !selectedNpp) {setError('Cần chọn đúng SKU, đơn vị NPP đã quy đổi và nhà phân phối.'); return;}
    void mutate(async () => {
      await desktopApi.createMasterLink({ kind: 'SKU_ALIAS', subjectId: skuId, distributorId: selectedNpp,
        externalCode: rawCode, unitCode: unit.unitCode, ratioNum: unit.ratioNum, ratioDen: unit.ratioDen,
        effectiveFrom: aliasFrom, effectiveTo: aliasTo || null });
      setRawCode('');
    }, 'Đã liên kết mã hàng NPP.');
  }
  function addPriceList(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!selectedNpp) {setError('Chọn NPP trước.'); return;}
    void mutate(async () => {
      const created=await desktopApi.createPriceList({ distributorId: selectedNpp, code: listCode,
        name: listName, priceType, effectiveFrom: listFrom, effectiveTo: listTo || null });
      setListId(created.id); setListCode(''); setListName('');
    }, 'Đã tạo bảng giá theo NPP.');
  }
  function addPriceItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!selectedList || !skuId) {setError('Chọn bảng giá và SKU.'); return;}
    if (!/^\d+$/.test(amount) || !Number.isSafeInteger(Number(amount))) {
      setError('Giá phải là số VND nguyên không âm.'); return;
    }
    if (!priceUnit) {setError('Cần chọn đơn vị giá đã đăng ký cho SKU.'); return;}
    void mutate(async () => {
      await desktopApi.createPriceItem({ priceListId: selectedList, productId: skuId, unitCode: priceUnit.unitCode ?? '',
        amountVnd: Number(amount), effectiveFrom: priceFrom, effectiveTo: priceTo || null });
      setAmount('');
    }, 'Đã lưu giá tham khảo.');
  }
  if (loading) return <section className="content-panel catalog-panel" role="status">
    <h2>Đang đọc sản phẩm và SKU</h2>
    <p>Ứng dụng đang tải danh mục sản phẩm chuẩn, nhóm hàng, nhãn hàng, đơn vị quy đổi, mã theo nhà phân phối và giá tham khảo đã được lưu trên máy.</p>
    <p>Nếu chưa có dữ liệu, anh có thể thêm thủ công theo từng bước hoặc nhập Excel sau khi dữ liệu hiện ra. Chưa có thông tin nào được ghi hoặc thay đổi.</p>
  </section>;
  const priceForms = <section className="content-panel catalog-panel">
      <h2>5. Bảng giá theo NPP</h2>
      <form onSubmit={addPriceList} className="catalog-form-grid">
        <label>Mã bảng giá<input required value={listCode} onChange={e => setListCode(e.target.value)} /></label>
        <label>Tên bảng giá<input required value={listName} onChange={e => setListName(e.target.value)} /></label>
        <label>Loại giá<input required value={priceType} onChange={e => setPriceType(e.target.value)} placeholder="Chọn mã loại giá theo nghiệp vụ" /></label>
        <label>Hiệu lực từ<input required type="date" value={listFrom} onChange={e => setListFrom(e.target.value)} /></label>
        <label>Đến ngày<input type="date" value={listTo} onChange={e => setListTo(e.target.value)} /></label>
        <button type="submit" disabled={busy || !selectedNpp}>Tạo bảng giá</button>
      </form>
      <form onSubmit={addPriceItem} className="catalog-form-grid">
        <label>Bảng giá<select required value={selectedList} onChange={e => setListId(e.target.value)}>
          <option value="">Chọn bảng giá</option>{activeLists.map(x => <option key={x.id} value={x.id}>{x.code} · {x.priceType}</option>)}</select></label>
        <label>SKU chuẩn<select required value={skuId} onChange={e => { setSkuId(e.target.value); setPriceUnitCode(''); setAliasUnitCode(''); }}>
          <option value="">Chọn SKU</option>{(view === 'Mã NPP & bảng giá' ? master.skus : familySkus).map(x =>
            <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></label>
        <label>Đơn vị giá<select required value={priceUnit?.unitCode ?? ''} onChange={e => setPriceUnitCode(e.target.value)}>
          <option value="">Chọn đơn vị giá</option>{registeredUnits.map(x => <option key={x.id} value={x.unitCode ?? ''}>{x.unitCode}</option>)}</select></label>
        <label>Giá tham khảo (VND)<input required inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <label>Áp dụng từ<input required type="date" value={priceFrom} onChange={e => setPriceFrom(e.target.value)} /></label>
        <label>Đến ngày<input type="date" value={priceTo} onChange={e => setPriceTo(e.target.value)} /></label>
        <button type="submit" disabled={busy || !selectedList || !skuId || !priceUnit}>Lưu giá</button>
      </form>
      <p className="catalog-small">Giá chỉ để tham khảo, không ghi doanh thu Sales In/Out. Trùng khoảng ngày sẽ bị chặn.</p>
    </section>;
  const forms = <div className="catalog-steps">
    <section className="content-panel catalog-panel">
      <h2>1. Sản phẩm chuẩn</h2><p>Danh mục chung giữa các NPP. Chọn sản phẩm ở cột bên trái hoặc thêm mới.</p>
      <form onSubmit={addOption} className="catalog-inline-form">
        <label>Thiết lập danh mục<select value={optionKind} onChange={e => setOptionKind(e.target.value as CatalogOptionKind)}>
          {Object.entries(kindLabels).map(([key,value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label>Mã<input required value={optionCode} onChange={e => setOptionCode(e.target.value)} /></label>
        <label>Tên<input required value={optionName} onChange={e => setOptionName(e.target.value)} /></label>
        <button type="submit" disabled={busy}>Thêm danh mục</button>
      </form>
      <form onSubmit={addFamily} className="catalog-form-grid">
        <label>Mã sản phẩm<input required value={familyCode} onChange={e => setFamilyCode(e.target.value)} /></label>
        <label>Tên sản phẩm<input required value={familyName} onChange={e => setFamilyName(e.target.value)} /></label>
        <label>Nhóm hàng<select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">Chưa phân nhóm</option>{catalog.categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Nhãn hàng<select value={brandId} onChange={e => setBrandId(e.target.value)}>
          <option value="">Chưa chọn</option>{catalog.brands.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <button className="catalog-primary" type="submit" disabled={busy}>Lưu sản phẩm</button>
      </form>
      {family ? <p className="catalog-small">Đang thiết lập: <strong>{family.code} · {family.name}</strong></p> : null}
    </section>
    <section className="content-panel catalog-panel">
      <h2>2. SKU và quy cách</h2>
      <form onSubmit={addSku} className="catalog-form-grid">
        <label>Mã SKU chuẩn<input required value={skuCode} onChange={e => setSkuCode(e.target.value)} /></label>
        <label>Tên SKU<input required value={skuName} onChange={e => setSkuName(e.target.value)} /></label>
        <label>Đơn vị cơ sở<input required value={skuUnit} onChange={e => setSkuUnit(e.target.value)} placeholder="Ví dụ: LON" /></label>
        <button type="submit" disabled={busy || !familyId}>Lưu SKU</button>
      </form>
      <label>SKU đang chọn<select value={skuId} onChange={e => { setSkuId(e.target.value); setAliasUnitCode(''); setPriceUnitCode(''); }}>
        <option value="">Chọn SKU</option>{familySkus.map(x => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></label>
    </section>
    <section className="content-panel catalog-panel">
      <h2>3. Đơn vị và quy đổi</h2><p>Nhập tỷ lệ chính xác về đơn vị cơ sở. Không tự tính từ tên thùng hoặc lon.</p>
      <form onSubmit={addUnit} className="catalog-form-grid">
        <label>Đơn vị<input required value={unitCode} onChange={e => setUnitCode(e.target.value)} placeholder="Ví dụ: THUNG" /></label>
        <label>Số lượng quy đổi<input required type="number" min="1" step="1" value={ratioNum} onChange={e => setRatioNum(e.target.value)} /></label>
        <label>Đơn vị chia<input required type="number" min="1" step="1" value={ratioDen} onChange={e => setRatioDen(e.target.value)} /></label>
        <button type="submit" disabled={busy || !skuId}>Lưu quy đổi</button>
      </form>
      <div className="catalog-chips">{registeredUnits.map(x => <span key={x.id}>{x.unitCode}: {x.ratioNum}/{x.ratioDen}</span>)}</div>
      <p className="catalog-small">Mã vạch là thông tin tùy chọn, chưa có API lưu mã vạch trong nền hiện tại.</p>
    </section>
    <section className="content-panel catalog-panel">
      <h2>4. Mã hàng theo NPP</h2>
      <form onSubmit={addAlias} className="catalog-form-grid">
        <label>Nhà phân phối<select required value={selectedNpp} onChange={e => setNppId(e.target.value)}>
          <option value="">Chọn NPP</option>{master.distributors.map(x => <option value={x.id} key={x.id}>{x.code} · {x.name}</option>)}</select></label>
        <label>Mã hàng tại NPP<input required value={rawCode} onChange={e => setRawCode(e.target.value)} /></label>
        <label>Đơn vị NPP<select required value={aliasUnit?.unitCode ?? ''} onChange={e => setAliasUnitCode(e.target.value)}>
          <option value="">Chọn đơn vị NPP</option>{registeredUnits.map(x => <option key={x.id} value={x.unitCode ?? ''}>{x.unitCode}</option>)}</select></label>
        <label>Từ ngày<input required type="date" value={aliasFrom} onChange={e => setAliasFrom(e.target.value)} /></label>
        <label>Đến ngày<input type="date" value={aliasTo} onChange={e => setAliasTo(e.target.value)} /></label>
        <button type="submit" disabled={busy || !skuId || !selectedNpp || !aliasUnit}>Lưu mã NPP</button>
      </form>
      <div className="catalog-chips">{skuAliases.map(x => <span key={x.id}>{master.distributors.find(n => n.id === x.distributorId)?.code ?? 'NPP'}:
        {x.externalCode} ({x.unitCode}) · {x.effectiveFrom}</span>)}</div>
    </section>
    {priceForms}

  </div>;
  return <div className="catalog-workspace">
    <ErrorLine error={error} notice={notice} />
    {(view === 'Thiết lập nhanh' || view === 'Danh sách sản phẩm') ? <div className="catalog-columns">
      <aside className="content-panel catalog-panel catalog-picker">
        <h2>Sản phẩm</h2><label>Tìm mã hoặc tên<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sản phẩm..." /></label>
        <div className="catalog-family-list" role="list">{searchMatch.map(item =>
          <button type="button" role="listitem" className={familyId === item.id ? 'selected' : ''}
            key={item.id} onClick={() => selectFamily(item.id)}><strong>{item.code}</strong><span>{item.name}</span></button>)}</div>
        {searchMatch.length === 0 ? <p>{emptyMessage}</p> : null}
        <p className="catalog-small">Sản phẩm chung, không tạo trùng theo NPP.</p>
      </aside>
      <div>{view === 'Thiết lập nhanh' ? forms : <div className="catalog-steps">
        <section className="content-panel catalog-panel">
          <h2>Danh sách sản phẩm và SKU</h2>
          {family ? <>
            <p><strong>{family.code}</strong> · {family.name} · {family.active ? 'Đang dùng' : 'Ngừng dùng'}</p>
            <form className="catalog-inline-form" onSubmit={e => {
              e.preventDefault(); void mutate(() => desktopApi.renameMasterItem({ kind: 'FAMILY', id: family.id, name: editName }), 'Đã đổi tên sản phẩm.');
            }}><label>Tên sản phẩm<input required value={editName} onChange={e => setEditName(e.target.value)} /></label>
              <button disabled={busy} type="submit">Lưu tên</button>
              <button disabled={busy} type="button" onClick={() => void mutate(
                () => desktopApi.setMasterActive({ kind: 'FAMILY', id: family.id, active: !family.active }),
                'Đã đổi trạng thái sản phẩm.')}>{family.active ? 'Ngừng sử dụng' : 'Sử dụng lại'}</button></form>
            <div className="catalog-excel-scroll"><table className="catalog-table"><thead><tr><th>SKU</th><th>Tên hàng</th><th>Đơn vị cơ sở</th><th>Trạng thái</th><th>Chọn</th></tr></thead>
              <tbody>{familySkus.map(x => <tr key={x.id}><td>{x.code}</td><td>{x.name}</td><td>{x.detail}</td><td>{x.active ? 'Đang dùng' : 'Ngừng dùng'}</td>
                <td><button type="button" onClick={() => { setSkuId(x.id); setAliasUnitCode(''); setPriceUnitCode(''); }}>{skuId === x.id ? 'Đang chọn' : 'Chọn SKU'}</button></td></tr>)}</tbody></table></div>
          </> : <p>{emptyMessage}</p>}
        </section>
      </div>}</div>
    </div> : null}
    {view === 'Mã NPP & bảng giá' ? <>
      <div className="content-panel catalog-panel"><h2>Danh sách mã NPP và giá tham khảo</h2>
        <div className="catalog-form-grid"><label>Nhà phân phối<select value={selectedNpp} onChange={e => setNppId(e.target.value)}>
          {master.distributors.map(x => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></label>
          <label>Bảng giá<select value={selectedList} onChange={e => setListId(e.target.value)}>
            {activeLists.map(x => <option key={x.id} value={x.id}>{x.code} · {x.name} · {x.priceType}</option>)}</select></label></div>
        <h3>Mã hàng NPP</h3>
        <div className="catalog-excel-scroll"><table className="catalog-table"><thead><tr><th>Mã NPP</th><th>Mã hàng nguồn</th><th>SKU chuẩn</th><th>Đơn vị</th><th>Hiệu lực</th></tr></thead>
          <tbody>{master.links.filter(x => x.kind === 'SKU_ALIAS' && x.distributorId === selectedNpp).map(x =>
            <tr key={x.id}><td>{master.distributors.find(n => n.id === x.distributorId)?.code}</td><td>{x.externalCode}</td>
              <td>{master.skus.find(s => s.id === x.subjectId)?.code}</td><td>{x.unitCode}</td>
              <td>{x.effectiveFrom} – {x.effectiveTo || 'Còn hiệu lực'}</td></tr>)}</tbody></table></div>
        <h3>Giá tham khảo</h3>
        <div className="catalog-excel-scroll"><table className="catalog-table"><thead><tr><th>SKU</th><th>Đơn vị</th><th>Giá (VND)</th><th>Từ ngày</th><th>Đến ngày</th><th>Trạng thái</th></tr></thead>
          <tbody>{priceRows.map(x => <tr key={x.id}><td>{master.skus.find(s => s.id === x.productId)?.code ?? 'Không xác định'}</td>
            <td>{x.unitCode}</td><td>{x.amountVnd.toLocaleString('vi-VN')}</td><td>{x.effectiveFrom}</td>
            <td>{x.effectiveTo ?? 'Chưa kết thúc'}</td><td>{x.active ? 'Đang dùng' : 'Ngừng dùng'}</td></tr>)}</tbody></table></div>
        <p className="catalog-small">Giá theo ngày và loại giá do người sử dụng chọn. Nếu có nhiều giá phù hợp, phải đối chiếu bảng giá nguồn.</p>
      </div>
      {priceForms}
      <section className="content-panel catalog-panel"><h2>Kết thúc kỳ giá</h2>
        <form className="catalog-form-grid" onSubmit={e => {e.preventDefault(); if (!closeId) return;
          void mutate(() => desktopApi.closePriceItem({ id: closeId, effectiveTo: closeDate }), 'Đã kết thúc kỳ giá.'); }}>
          <label>Dòng giá<select required value={closeId} onChange={e => setCloseId(e.target.value)}>
            <option value="">Chọn dòng giá</option>{priceRows.map(x => <option key={x.id} value={x.id}>{master.skus.find(s => s.id === x.productId)?.code} · {x.unitCode} · {x.effectiveFrom}</option>)}</select></label>
          <label>Ngày kết thúc<input required type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} /></label>
          <button type="submit" disabled={busy || !closeId}>Lưu ngày kết thúc</button>
        </form></section>
    </> : null}
    {view === 'Nhập Excel' ? <CatalogExcel master={master} catalog={catalog} onChange={load} /> : null}
    {view === 'Phân tích SKU' ? <section className="content-panel catalog-panel">
      <h2>Thực hiện theo SKU từ chứng từ đã nhập</h2>
      <p>Số liệu lấy từ Sales In/Out đã xác nhận, tách riêng hai nguồn và trừ hoàn hàng. Không dùng bảng giá tham khảo để tính doanh thu.</p>
      {metrics.length ? <div className="catalog-excel-scroll"><table className="catalog-table">
        <thead><tr><th>NPP</th><th>SKU chuẩn</th><th>Nguồn</th><th>Đơn vị cơ sở</th><th>Sản lượng</th><th>Doanh số (VND)</th><th>Từ ngày</th><th>Đến ngày</th><th>Dòng nguồn</th></tr></thead>
        <tbody>{metrics.map(m => <tr key={m.distributorId + ':' + m.productId + ':' + m.sourceKind}>
          <td>{master.distributors.find(n => n.id === m.distributorId)?.name ?? 'Chưa xác định NPP'}</td>
          <td>{master.skus.find(x => x.id === m.productId)?.code ?? 'Không xác định'}</td>
          <td>{m.sourceKind === 'SALES_IN' ? 'Sales In' : 'Sales Out'}</td>
          <td>{master.skus.find(x => x.id === m.productId)?.detail ?? '—'}</td>
          <td>{(m.quantityMicro / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 6 })}</td>
          <td>{m.netAmountVnd.toLocaleString('vi-VN')}</td>
          <td>{m.firstDate}</td><td>{m.lastDate}</td><td>{m.transactionRows}</td>
        </tr>)}</tbody></table></div> : <p>Chưa có chứng từ Sales In/Out đã xác nhận để phân tích. Danh mục phía dưới không đồng nghĩa đã phát sinh doanh thu.</p>}
      <h3>Mức độ hoàn thiện danh mục và mã NPP</h3>
      <div className="catalog-excel-scroll"><table className="catalog-table"><thead><tr><th>Mã SKU</th><th>Tên SKU</th><th>Sản phẩm</th><th>Đơn vị</th><th>Số mã NPP</th><th>Dòng giá</th></tr></thead>
        <tbody>{master.skus.map(s => <tr key={s.id}><td>{s.code}</td><td>{s.name}</td>
          <td>{master.families.find(f => f.id === s.parentId)?.name || 'Chưa gán'}</td><td>{s.detail}</td>
          <td>{master.links.filter(x => x.kind === 'SKU_ALIAS' && x.subjectId === s.id).length}</td>
          <td>{catalog.priceItems.filter(x => x.productId === s.id).length}</td></tr>)}</tbody></table></div>
      {!master.skus.length ? <p>{emptyMessage}</p> : null}
    </section> : null}
  </div>;
}
