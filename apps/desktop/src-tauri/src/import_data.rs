//! M2.2 preview + M2.3 explicit atomic activation. Source codes are scoped to
//! distributor and business date; every commit re-parses and validates the bytes.
use crate::{import_parse::{self,Sheet},storage::AppDatabase};
use rusqlite::{params,Connection,OptionalExtension,Transaction};
use serde::{Deserialize,Serialize};
use sha2::{Digest,Sha256};
use std::{collections::{HashMap,HashSet},sync::MutexGuard};
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all="camelCase")]
pub struct ImportError {code:&'static str,message:String}
fn invalid(s:&str)->ImportError{ImportError{code:"IMPORT_INVALID",message:s.to_owned()}}
fn failed()->ImportError{invalid("Không thể kiểm tra hoặc ghi dữ liệu. Vui lòng thử lại.")}
fn conflict(s:&str)->ImportError{ImportError{code:"IMPORT_CONFLICT",message:s.to_owned()}}
#[derive(Debug,Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct ImportRequest {
    file_name:String,
    bytes:Vec<u8>,
    kind:String,
    distributor_id:String,
    period_from:String,
    period_to:String,
    sheet_name:String,
    header_row:usize,
    columns:HashMap<String,String>,
    row_kind:String,
    positive_value:Option<String>,
    return_value:Option<String>,
    cancel_value:Option<String>,
}
#[derive(Debug,Serialize)]
#[serde(rename_all="camelCase")]
pub struct RowView {row:usize,values:Vec<String>}
#[derive(Debug,Serialize)]
#[serde(rename_all="camelCase")]
pub struct SheetView {name:String,rows:usize,first_rows:Vec<RowView>,has_formulas:bool}
#[derive(Debug,Serialize)]
#[serde(rename_all="camelCase")]
pub struct FileView {sheets:Vec<SheetView>,sha256:String}
#[derive(Debug,Clone,Serialize)]
#[serde(rename_all="camelCase")]
pub struct ImportIssue {row:usize,column:String,severity:&'static str,message:String}
#[derive(Debug,Serialize)]
#[serde(rename_all="camelCase")]
pub struct Preview {
    sha256:String,
    total_rows:usize,
    valid_rows:usize,
    skipped_rows:usize,
    unknown_employees:usize,
    issues:Vec<ImportIssue>,
    error_rows:usize,
    sample:Vec<RowView>,
    has_previous:bool,
    same_file_already_active:bool,
}
#[derive(Debug,Serialize)]
#[serde(rename_all="camelCase")]
pub struct ImportResult {id:String,inserted:usize,unresolved:usize,replaced:bool,already_imported:bool}
#[derive(Debug,Serialize)]
#[serde(rename_all="camelCase")]
pub struct ImportHistory {id:String,kind:String,distributor_name:String,period_from:String,period_to:String,source_file_name:String,source_sheet:Option<String>,status:String,active:bool,total_rows:i64,valid_rows:i64,error_rows:i64,imported_at_utc:String}
#[derive(Clone)]
struct Fact {row:usize,sku:String,employee:Option<String>,business_date:String,document:String,line:Option<String>,kind:String,quantity:i64,amount:i64}
struct Checked {facts:Vec<Fact>,issues:Vec<ImportIssue>,total:usize,skipped:usize,unknown:usize,error_rows:usize,sha:String,previous:Option<(String,String)>}

fn digest(b:&[u8])->String{format!("{:x}",Sha256::digest(b))}
fn valid_date(d:&str)->bool{
    let v=d.as_bytes();
    if v.len()!=10||v[4]!=b'-'||v[7]!=b'-'||v.iter().enumerate().any(|(i,c)|i!=4&&i!=7&&!c.is_ascii_digit()){return false;}
    let (Ok(year),Ok(month),Ok(day))=(d[..4].parse::<i32>(),d[5..7].parse::<u32>(),d[8..10].parse::<u32>())else{return false};
    if year<1900 || !(1..=12).contains(&month) {return false;}
    let leap=year%4==0&&(year%100!=0||year%400==0);
    let md=[31,if leap{29}else{28},31,30,31,30,31,31,30,31,30,31];
    day>0&&day<=md[(month-1) as usize]
}
fn date(value:&str)->Option<String>{
    let v=value.trim();
    if valid_date(v){return Some(v.into());}
    let parts:Vec<_>=v.split('/').collect();
    if parts.len()==3{
        let (Ok(d),Ok(m),Ok(y))=(parts[0].parse::<u32>(),parts[1].parse::<u32>(),parts[2].parse::<i32>())else{return None};
        let iso=format!("{y:04}-{m:02}-{d:02}");
        if valid_date(&iso){return Some(iso);}
    }
    // Excel 1900 day count: 25569 corresponds to 1970-01-01.
    if let Ok(serial)=v.parse::<i64>(){
        if (61..=2_958_465).contains(&serial){
            let days=serial-25_569;
            let (year,month,day)=civil_from_unix_days(days);
            let iso=format!("{year:04}-{month:02}-{day:02}");
            if valid_date(&iso){return Some(iso);}
        }
    }
    None
}
fn civil_from_unix_days(days:i64)->(i64,i64,i64){
    let z=days+719468;
    let era=if z>=0{z}else{z-146096}/146097;
    let doe=z-era*146097;
    let yoe=(doe-doe/1460+doe/36524-doe/146096)/365;
    let mut y=yoe+era*400;
    let doy=doe-(365*yoe+yoe/4-yoe/100);
    let mp=(5*doy+2)/153;
    let d=doy-(153*mp+2)/5+1;
    let m=mp+if mp<10{3}else{-9};
    if m<=2{y+=1;}
    (y,m,d)
}
fn fixed_micro(raw:&str)->Option<i64>{
    let s=raw.trim();
    if s.is_empty()||s.starts_with('-')||s.contains(',') {return None;}
    let mut it=s.split('.');
    let whole=it.next()?;let frac=it.next().unwrap_or("");
    if it.next().is_some()||whole.is_empty()||!whole.bytes().all(|x|x.is_ascii_digit())||!frac.bytes().all(|x|x.is_ascii_digit())||frac.len()>6{return None;}
    let n=whole.parse::<i128>().ok()?.checked_mul(1_000_000)?;
    let sub=if frac.is_empty(){0}else{frac.parse::<i128>().ok()?.checked_mul(10_i128.pow((6-frac.len()) as u32))?};
    i64::try_from(n.checked_add(sub)?).ok()
}
fn whole_vnd(raw:&str)->Option<i64>{
    let s=raw.trim();let s=s.trim_start_matches('-');
    if s.is_empty()||!s.bytes().all(|x|x.is_ascii_digit()){return None;}
    raw.trim().parse::<i64>().ok().and_then(|x|x.checked_abs())
}
fn as_date(s:&str)->Result<String,ImportError>{date(s).ok_or_else(||invalid("Ngày không hợp lệ. Hãy dùng YYYY-MM-DD hoặc DD/MM/YYYY."))}
fn verify_request(r:&ImportRequest)->Result<(),ImportError>{
    if !["SALES_IN","SALES_OUT"].contains(&r.kind.as_str()) || r.distributor_id.trim().is_empty()
        || r.file_name.len()>255 || r.sheet_name.trim().is_empty() || r.header_row==0 || r.header_row>20
        || r.period_from>r.period_to || !valid_date(&r.period_from)||!valid_date(&r.period_to)
        || r.columns.len()>16 {return Err(invalid("Kiểm tra NPP, kỳ, loại doanh số, trang tính và dòng tiêu đề."));}
    for field in ["date","sku","unit","quantity","amount","document"] {
        if r.columns.get(field).is_none_or(|h|h.trim().is_empty()){return Err(invalid("Cần chọn đủ cột ngày, mã hàng, đơn vị, số lượng, tiền và chứng từ."));}
    }
    if !matches!((r.kind.as_str(),r.row_kind.as_str()),("SALES_IN","INVOICE"|"RETURN")|("SALES_OUT","DELIVERED"|"RETURN")){
        return Err(invalid("Hãy xác định rõ loại chứng từ bán hoặc trả hàng."));
    }
    Ok(())
}
fn selected_sheet<'a>(sheets:&'a [Sheet],r:&ImportRequest)->Result<&'a Sheet,ImportError>{
    sheets.iter().find(|s|s.name==r.sheet_name).ok_or_else(||invalid("Không thấy trang tính đã chọn."))
}
fn issue(row:usize,column:&str,severity:&'static str,message:&str)->ImportIssue{
    ImportIssue{row,column:column.into(),severity,message:message.into()}
}
fn column_map(sheet:&Sheet,r:&ImportRequest)->Result<HashMap<String,usize>,ImportError>{
    let headers=sheet.rows.iter().find(|(i,_)|*i==r.header_row).map(|(_,cells)|cells).ok_or_else(||invalid("Không tìm thấy dòng tiêu đề đã chọn."))?;
    let mut indices=HashMap::new();let mut used=HashSet::new();
    for (field,header) in &r.columns {
        if !["date","sku","unit","quantity","amount","document","line","employee","type"].contains(&field.as_str()){return Err(invalid("Có loại cột không hợp lệ."));}
        let matches:Vec<_>=headers.iter().enumerate().filter(|(_,h)|*h==header).map(|(i,_)|i).collect();
        if matches.len()!=1{return Err(invalid("Tên cột bị trùng hoặc không tìm thấy. Hãy chọn lại dòng tiêu đề."));}
        if !used.insert(matches[0]){return Err(invalid("Không thể dùng một cột Excel cho hai loại thông tin."));}
        indices.insert(field.clone(),matches[0]);
    }
    Ok(indices)
}
fn get<'a>(row:&'a [String],indices:&HashMap<String,usize>,field:&str)->&'a str{
    indices.get(field).and_then(|i|row.get(*i)).map(String::as_str).unwrap_or("").trim()
}
fn classify(r:&ImportRequest,source:&str)->Result<Option<&'static str>,String>{
    if !r.columns.contains_key("type"){return Ok(Some(if r.row_kind=="RETURN"{"RETURN"}else if r.kind=="SALES_IN"{"INVOICE"}else{"DELIVERED"}));}
    let positive=r.positive_value.as_deref().unwrap_or(if r.kind=="SALES_IN"{"INVOICE"}else{"DELIVERED"});
    let returned=r.return_value.as_deref().unwrap_or("RETURN");
    let cancelled=r.cancel_value.as_deref().unwrap_or("CANCELLED");
    if positive.trim().is_empty()||returned.trim().is_empty()||positive.eq_ignore_ascii_case(returned){
        return Err("Giá trị loại chứng từ bán/trả chưa hợp lệ.".into());
    }
    if source.eq_ignore_ascii_case(positive){Ok(Some(if r.kind=="SALES_IN"{"INVOICE"}else{"DELIVERED"}))}
    else if source.eq_ignore_ascii_case(returned){Ok(Some("RETURN"))}
    else if !cancelled.trim().is_empty()&&source.eq_ignore_ascii_case(cancelled){Ok(None)}
    else{Err("Loại chứng từ không khớp giá trị đã khai báo. Kiểm tra dòng này.".into())}
}
fn lookup_sku(db:&Connection,npp:&str,code:&str,unit:&str,on:&str)->rusqlite::Result<Option<(String,i64,i64)>>{
    db.query_row("SELECT product_id,conversion_num,conversion_den FROM sku_aliases
       WHERE distributor_id=?1 AND raw_sku_code=?2 AND raw_unit=?3 AND effective_from<=?4 AND (effective_to IS NULL OR effective_to>=?4)",
       params![npp,code,unit,on],|row|Ok((row.get(0)?,row.get(1)?,row.get(2)?))).optional()
}
fn lookup_employee(db:&Connection,npp:&str,code:&str,on:&str)->rusqlite::Result<Option<String>>{
    db.query_row("SELECT employee_id FROM employee_code_aliases
       WHERE distributor_id=?1 AND raw_employee_code=?2 AND effective_from<=?3 AND (effective_to IS NULL OR effective_to>=?3)",
       params![npp,code,on],|row|row.get(0)).optional()
}
fn active(db:&Connection,r:&ImportRequest)->rusqlite::Result<Option<(String,String)>>{
    db.query_row("SELECT id,source_file_sha256 FROM import_batches
       WHERE kind=?1 AND distributor_id=?2 AND period_from=?3 AND period_to=?4 AND active=1",
       params![r.kind,r.distributor_id,r.period_from,r.period_to],|row|Ok((row.get(0)?,row.get(1)?))).optional()
}
fn checked(db:&Connection,r:&ImportRequest)->Result<Checked,ImportError>{
    verify_request(r)?;
    let exists:i64=db.query_row("SELECT count(*) FROM distributors WHERE id=?1 AND active=1",[&r.distributor_id],|x|x.get(0)).map_err(|_|failed())?;
    if exists!=1{return Err(invalid("Nhà phân phối chưa có hoặc đã ngừng sử dụng."));}
    let sheets=import_parse::parse(&r.file_name,&r.bytes).map_err(|s|invalid(&s))?;
    let sheet=selected_sheet(&sheets,r)?;
    let map=column_map(sheet,r)?;
    let mut facts=Vec::new();let mut issues=Vec::new();let mut seen=HashSet::new();
    let(mut total,mut skipped,mut unknown,mut error_rows)=(0usize,0usize,0usize,0usize);
    for (i,cells) in sheet.rows.iter().filter(|(i,_)|*i>r.header_row){
        if cells.iter().all(|c|c.trim().is_empty()){continue;}
        total+=1;
        let mut report=|col:&str,msg:&str|{
            error_rows+=1;
            if issues.len()<250 {issues.push(issue(*i,col,"ERROR",msg));}
        };
        if cells.iter().any(|x|x=="[CÔNG THỨC]"){report("Excel","Tệp có công thức tại dòng này. Hãy chuyển thành giá trị trước khi nhập.");continue;}
        let on=match as_date(get(cells,&map,"date")){Ok(v)=>v,Err(_)=>{report("Ngày","Ngày không hợp lệ.");continue;}};
        if on<r.period_from || on>r.period_to {report("Ngày","Ngày chứng từ ngoài kỳ đã chọn.");continue;}
        let status=match classify(r,get(cells,&map,"type")){
            Ok(Some(v))=>v,Ok(None)=>{skipped+=1;continue;},
            Err(_)=>{report("Loại chứng từ","Không nhận diện được loại bán/trả/hủy.");continue;}
        };
        let code=get(cells,&map,"sku");
        let unit=get(cells,&map,"unit");
        let sku=match lookup_sku(db,&r.distributor_id,code,unit,&on).map_err(|_|failed())?{
            Some((id,n,d)) if n>0&&d>0=>(id,n,d),
            _=>{report("Mã hàng","Không tìm thấy mã hàng và đơn vị của NPP trong thời gian đã chọn.");continue;}
        };
        if status!="RETURN" && (get(cells,&map,"quantity").starts_with('-') || get(cells,&map,"amount").starts_with('-')) {
            report("Số lượng / giá trị","Doanh số bán ra không được âm. Chỉ dòng trả hàng được ghi số âm.");continue;
        }
        let quantity=match fixed_micro(get(cells,&map,"quantity").trim_start_matches('-')){
            Some(v)=>v,None=>{report("Số lượng","Số lượng phải là số không âm, tối đa 6 chữ số thập phân.");continue;}
        };
        let adjusted=(quantity as i128).checked_mul(sku.1 as i128).and_then(|v|v.checked_div(sku.2 as i128));
        let Some(micro)=adjusted.and_then(|v|i64::try_from(v).ok()) else {
            report("Số lượng","Quy đổi số lượng vượt giới hạn.");continue;
        };
        if (quantity as i128)*sku.1 as i128 % sku.2 as i128 !=0 {
            report("Số lượng","Quy đổi ra đơn vị cơ sở không chính xác.");continue;
        }
        let amount=match whole_vnd(get(cells,&map,"amount")){
            Some(v)=>v,None=>{report("Giá trị","Tiền VND phải là số nguyên, không dùng dấu phân cách hàng nghìn.");continue;}
        };
        let doc=get(cells,&map,"document");
        if doc.is_empty(){report("Chứng từ","Thiếu số chứng từ.");continue;}
        let line=get(cells,&map,"line");
        let duplicate=(on.clone(),doc.to_owned(),line.to_owned(),sku.0.clone(),status.to_owned());
        if !seen.insert(duplicate){report("Chứng từ","Trùng dòng chứng từ trong tệp.");continue;}
        let staff=get(cells,&map,"employee");
        let employee=if r.kind=="SALES_OUT"&&!staff.is_empty(){
            lookup_employee(db,&r.distributor_id,staff,&on).map_err(|_|failed())?
        }else{None};
        if r.kind=="SALES_OUT"&&employee.is_none(){
            unknown+=1;
            if issues.len()<250{issues.push(issue(*i,"Nhân viên","WARNING","Chưa xác định nhân viên từ mã NPP; doanh số vẫn được giữ riêng."));}
        }
        let sign=if status=="RETURN"{-1}else{1};
        facts.push(Fact{row:*i,sku:sku.0,employee,business_date:on,document:doc.into(),
            line:if line.is_empty(){None}else{Some(line.into())},kind:status.into(),quantity:micro*sign,amount:amount*sign});
    }
    let previous=active(db,r).map_err(|_|failed())?;
    Ok(Checked{facts,issues,total,skipped,unknown,error_rows,sha:digest(&r.bytes),previous})
}
fn summarize(c:&Checked)->(usize,usize){
    let err_count=c.error_rows;
    (c.facts.len(),err_count)
}
#[tauri::command]
pub fn inspect_import_file(file_name:String,bytes:Vec<u8>)->Result<FileView,ImportError>{
    let sheets=import_parse::parse(&file_name,&bytes).map_err(|s|invalid(&s))?;
    Ok(FileView{sheets:sheets.into_iter().map(|s|SheetView{name:s.name,rows:s.rows.len(),
        first_rows:s.rows.iter().take(12).map(|(row,values)|RowView{row:*row,values:values.clone()}).collect(),
        has_formulas:s.has_formulas}).collect(),sha256:digest(&bytes)})
}
fn conn(db:&State<'_,AppDatabase>)->Result<MutexGuard<'_,Connection>,ImportError>{
    db.connection.lock().map_err(|_|failed())
}
#[tauri::command]
pub fn preview_import(db:State<'_,AppDatabase>,request:ImportRequest)->Result<Preview,ImportError>{
    let db=conn(&db)?;
    let c=checked(&db,&request)?;
    let (valid,_)=summarize(&c);
    Ok(Preview{sha256:c.sha.clone(),total_rows:c.total,valid_rows:valid,skipped_rows:c.skipped,error_rows:c.error_rows,
        unknown_employees:c.unknown,issues:c.issues,sample:import_parse::parse(&request.file_name,&request.bytes)
            .map_err(|s|invalid(&s))?.into_iter().find(|s|s.name==request.sheet_name).map(|s|s.rows.into_iter()
            .filter(|(row,_)|*row>request.header_row).take(12).map(|(row,values)|RowView{row,values}).collect()).unwrap_or_default(),
        has_previous:c.previous.is_some(),same_file_already_active:c.previous.is_some_and(|(_,h)|h==c.sha)})
}
#[tauri::command]
pub fn commit_import(db:State<'_,AppDatabase>,request:ImportRequest,expected_sha256:String,replace_existing:bool)->Result<ImportResult,ImportError>{
    if digest(&request.bytes)!=expected_sha256{return Err(conflict("Tệp đã thay đổi từ khi xem trước. Hãy kiểm tra lại."));}
    let connection=conn(&db)?;
    let tx=connection.unchecked_transaction().map_err(|_|failed())?;
    let c=checked(&tx,&request)?;
    if c.error_rows>0{return Err(conflict("Tệp còn dòng lỗi. Hãy kiểm tra và sửa trước khi nhập."));}
    if c.facts.is_empty(){return Err(invalid("Tệp không có dòng hợp lệ để nhập."));}
    if let Some((id,hash))=&c.previous {
        if hash==&c.sha{return Ok(ImportResult{id:id.clone(),inserted:0,unresolved:c.unknown,replaced:false,already_imported:true});}
        if !replace_existing{return Err(conflict("Đã có dữ liệu cho NPP và kỳ này. Chọn thay dữ liệu cũ nếu muốn nhập bản sửa."));}
    }
    let id:String=tx.query_row("SELECT lower(hex(randomblob(16)))",[],|x|x.get(0)).map_err(|_|failed())?;
    let profile_id:String=tx.query_row("SELECT lower(hex(randomblob(16)))",[],|x|x.get(0)).map_err(|_|failed())?;
    let map=serde_json::json!({"headerRow":request.header_row,"columns":request.columns,"positiveValue":request.positive_value,"returnValue":request.return_value,"cancelValue":request.cancel_value,"rowKind":request.row_kind});
    let now="strftime('%Y-%m-%dT%H:%M:%fZ','now')";
    tx.execute(&format!("INSERT INTO import_profiles(id,name,kind,version,mapping_json,created_at_utc)
      VALUES(?1,?2,?3,1,?4,{now})"),params![profile_id,format!("{}:{}:{}",request.kind,request.distributor_id,profile_id),request.kind,map.to_string()]).map_err(|_|failed())?;
    tx.execute(&format!("INSERT OR IGNORE INTO imported_file_archives(sha256,original_name,file_bytes,saved_at_utc) VALUES(?1,?2,?3,{now})"),
        params![c.sha,request.file_name,request.bytes]).map_err(|_|failed())?;
    if let Some((old,_))=&c.previous {
        tx.execute("UPDATE import_batches SET status='SUPERSEDED',active=0 WHERE id=?1 AND active=1",[old]).map_err(|_|failed())?;
    }
    tx.execute(&format!("INSERT INTO import_batches(id,kind,distributor_id,period_from,period_to,granularity,source_file_name,source_file_sha256,
        source_sheet,import_profile_id,status,active,supersedes_batch_id,total_rows,valid_rows,error_rows,imported_at_utc,committed_at_utc)
        VALUES(?1,?2,?3,?4,?5,'TRANSACTION',?6,?7,?8,?9,'COMMITTED',1,?10,?11,?12,0,{now},{now})"),
        params![id,request.kind,request.distributor_id,request.period_from,request.period_to,request.file_name,c.sha,request.sheet_name,
        profile_id,c.previous.as_ref().map(|(x,_)|x),c.total as i64,c.facts.len() as i64]).map_err(|_|failed())?;
    for fact in &c.facts{
        if request.kind=="SALES_IN"{
            tx.execute("INSERT INTO sales_in_facts(id,batch_id,distributor_id,product_id,business_date,document_no,document_line_no,kind,quantity_micro,net_amount_vnd,source_row)
            VALUES(lower(hex(randomblob(16))),?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![id,request.distributor_id,fact.sku,fact.business_date,fact.document,fact.line,fact.kind,fact.quantity,fact.amount,fact.row as i64]).map_err(|_|failed())?;
        }else{
            tx.execute("INSERT INTO sales_out_facts(id,batch_id,distributor_id,product_id,employee_id,business_date,document_no,document_line_no,kind,quantity_micro,net_amount_vnd,source_row)
            VALUES(lower(hex(randomblob(16))),?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![id,request.distributor_id,fact.sku,fact.employee,fact.business_date,fact.document,fact.line,fact.kind,fact.quantity,fact.amount,fact.row as i64]).map_err(|_|failed())?;
        }
    }
    for item in c.issues.iter().filter(|x|x.severity=="WARNING"){
        tx.execute("INSERT INTO import_issues(batch_id,sheet_name,source_row,column_name,severity,issue_code,message) VALUES(?1,?2,?3,?4,'WARNING','UNRESOLVED_EMPLOYEE',?5)",
            params![id,request.sheet_name,item.row as i64,item.column,item.message]).map_err(|_|failed())?;
    }
    tx.execute(&format!("INSERT INTO audit_events(id,event_type,actor_profile_id,entity_type,entity_id,created_at_utc)
        VALUES(lower(hex(randomblob(16))),'IMPORT_COMMIT',(SELECT id FROM local_operator WHERE id=1),'IMPORT_BATCH',?1,{now})"),[&id]).map_err(|_|failed())?;
    tx.commit().map_err(|_|failed())?;
    Ok(ImportResult{id,inserted:c.facts.len(),unresolved:c.unknown,replaced:c.previous.is_some(),already_imported:false})
}
#[tauri::command]
pub fn list_import_history(db:State<'_,AppDatabase>)->Result<Vec<ImportHistory>,ImportError>{
    let c=conn(&db)?;
    let mut stmt=c.prepare("SELECT b.id,b.kind,d.name,COALESCE(b.period_from,''),COALESCE(b.period_to,''),
        b.source_file_name,b.source_sheet,b.status,b.active,b.total_rows,b.valid_rows,b.error_rows,b.imported_at_utc
        FROM import_batches b JOIN distributors d ON d.id=b.distributor_id ORDER BY b.imported_at_utc DESC,b.id DESC LIMIT 200").map_err(|_|failed())?;
    let values=stmt.query_map([],|x|Ok(ImportHistory{id:x.get(0)?,kind:x.get(1)?,distributor_name:x.get(2)?,
        period_from:x.get(3)?,period_to:x.get(4)?,source_file_name:x.get(5)?,source_sheet:x.get(6)?,
        status:x.get(7)?,active:x.get(8)?,total_rows:x.get(9)?,valid_rows:x.get(10)?,
        error_rows:x.get(11)?,imported_at_utc:x.get(12)?})).map_err(|_|failed())?;
    values.collect::<rusqlite::Result<Vec<_>>>().map_err(|_|failed())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    fn request()->ImportRequest{
        ImportRequest{file_name:"npp.csv".into(),bytes:b"date;sku;unit;qty;amount;doc;staff\n2026-10-01;0007;THUNG;2;240000;INV1;NV01\n".to_vec(),
        kind:"SALES_OUT".into(),distributor_id:"npp".into(),period_from:"2026-10-01".into(),period_to:"2026-10-31".into(),
        sheet_name:"CSV".into(),header_row:1,columns:[
          ("date","date"),("sku","sku"),("unit","unit"),("quantity","qty"),("amount","amount"),("document","doc"),("employee","staff")]
          .into_iter().map(|(a,b)|(a.into(),b.into())).collect(),row_kind:"DELIVERED".into(),
          positive_value:None,return_value:None,cancel_value:None}
    }
    fn setup(c:&Connection){
        c.execute_batch("INSERT INTO distributors(id,code,name,created_at_utc) VALUES('npp','NPP','Distributor','2026');
         INSERT INTO products(id,sku_code,name,base_unit) VALUES('item','P','Item','LON');
         INSERT INTO sku_aliases(id,distributor_id,raw_sku_code,product_id,raw_unit,conversion_num,conversion_den,effective_from)
           VALUES('a','npp','0007','item','THUNG',24,1,'2026-01-01');
         INSERT INTO employees(id,code,full_name,role) VALUES('e','E','Rep','SALES');
         INSERT INTO employee_code_aliases(id,distributor_id,raw_employee_code,employee_id,effective_from)
           VALUES('b','npp','NV01','e','2026-01-01');
        ").unwrap();
    }
    #[test] fn preview_scoped_code_and_decimal_dates(){
        let d=tempdir().unwrap();let db=AppDatabase::open(d.path()).unwrap();
        let c=db.connection.lock().unwrap();setup(&c);
        let checked=checked(&c,&request()).unwrap();
        assert_eq!(checked.facts.len(),1);
        assert_eq!(checked.facts[0].quantity,48_000_000);
        assert_eq!(checked.facts[0].employee.as_deref(),Some("e"));
        assert_eq!(date("01/10/2026").as_deref(),Some("2026-10-01"));
        assert_eq!(date("46296").as_deref(),Some("2026-10-01"));
    }
    #[test] fn missing_employee_remains_unassigned(){
        let d=tempdir().unwrap();let db=AppDatabase::open(d.path()).unwrap();
        let c=db.connection.lock().unwrap();setup(&c);
        let mut r=request();r.bytes=b"date;sku;unit;qty;amount;doc;staff\n2026-10-01;0007;THUNG;1;10;INV1;0000\n".to_vec();
        let result=checked(&c,&r).unwrap();
        assert_eq!(result.unknown,1);
        assert!(result.facts[0].employee.is_none());
        assert!(result.issues.iter().any(|i|i.severity=="WARNING"));
    }
}
