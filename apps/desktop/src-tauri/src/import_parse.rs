//! Offline, bounded CSV/XLSX table reader. Never executes formulas, macros, or external links.
use flate2::read::DeflateDecoder;
use quick_xml::{
    events::{BytesStart, Event},
    Reader,
};
use std::{collections::HashMap, io::Read};

const MAX_FILE: usize = 6 * 1024 * 1024;
const MAX_XML: usize = 12 * 1024 * 1024;
const MAX_ROWS: usize = 20_001;
const MAX_COLUMNS: usize = 100;

#[derive(Clone, Debug)]
pub struct Sheet {
    pub name: String,
    pub rows: Vec<(usize, Vec<String>)>,
    pub has_formulas: bool,
}

fn err(message: &str) -> String {
    message.to_owned()
}
fn u16_at(b: &[u8], i: usize) -> Result<usize, String> {
    let s = b
        .get(i..i + 2)
        .ok_or_else(|| err("Tệp Excel không hợp lệ."))?;
    Ok(u16::from_le_bytes([s[0], s[1]]) as usize)
}
fn u32_at(b: &[u8], i: usize) -> Result<usize, String> {
    let s = b
        .get(i..i + 4)
        .ok_or_else(|| err("Tệp Excel không hợp lệ."))?;
    Ok(u32::from_le_bytes([s[0], s[1], s[2], s[3]]) as usize)
}
fn zip_xml_entries(src: &[u8]) -> Result<HashMap<String, Vec<u8>>, String> {
    if src.len() < 22 {
        return Err(err("Tệp Excel bị hỏng."));
    }
    let lower = src.len().saturating_sub(65_557);
    let eocd = (lower..=src.len() - 22)
        .rev()
        .find(|&i| src.get(i..i + 4) == Some(b"PK\x05\x06"))
        .ok_or_else(|| err("Không đọc được cấu trúc Excel."))?;
    if u16_at(src, eocd + 4)? != 0 || u16_at(src, eocd + 6)? != 0 {
        return Err(err("Không hỗ trợ tệp Excel nhiều phần."));
    }
    let count = u16_at(src, eocd + 10)?;
    let end = u32_at(src, eocd + 16)?
        .checked_add(u32_at(src, eocd + 12)?)
        .ok_or_else(|| err("Excel quá lớn."))?;
    let mut pos = u32_at(src, eocd + 16)?;
    if count > 500 || end > src.len() {
        return Err(err("Tệp Excel có cấu trúc không hợp lệ."));
    }
    let mut result = HashMap::new();
    let mut inflated = 0usize;
    for _ in 0..count {
        if src.get(pos..pos + 4) != Some(b"PK\x01\x02") {
            return Err(err("Tệp Excel bị hỏng."));
        }
        let flags = u16_at(src, pos + 8)?;
        let method = u16_at(src, pos + 10)?;
        let packed = u32_at(src, pos + 20)?;
        let unpacked = u32_at(src, pos + 24)?;
        let name_len = u16_at(src, pos + 28)?;
        let extra = u16_at(src, pos + 30)?;
        let comment = u16_at(src, pos + 32)?;
        let loc = u32_at(src, pos + 42)?;
        let bytes = src
            .get(pos + 46..pos + 46 + name_len)
            .ok_or_else(|| err("Tệp Excel bị hỏng."))?;
        let name = std::str::from_utf8(bytes)
            .map_err(|_| err("Đường dẫn Excel không hợp lệ."))?
            .to_string();
        pos = pos
            .checked_add(46 + name_len + extra + comment)
            .ok_or_else(|| err("Tệp Excel quá lớn."))?;
        if pos > end
            || name.starts_with('/')
            || name.split('/').any(|s| s == "..")
            || name.contains('\\')
        {
            return Err(err("Tệp Excel có đường dẫn không hợp lệ."));
        }
        // Read only workbook XML; ignore images and extra documents, never follow links.
        if !name.starts_with("xl/") || !(name.ends_with(".xml") || name.ends_with(".rels")) {
            continue;
        }
        if flags & 1 != 0 || packed == usize::MAX || unpacked > MAX_XML || ![0, 8].contains(&method)
        {
            return Err(err("Tệp Excel có phần không được hỗ trợ."));
        }
        if src.get(loc..loc + 4) != Some(b"PK\x03\x04") {
            return Err(err("Tệp Excel bị hỏng."));
        }
        let start = loc
            .checked_add(30 + u16_at(src, loc + 26)? + u16_at(src, loc + 28)?)
            .ok_or_else(|| err("Tệp Excel quá lớn."))?;
        let end_data = start
            .checked_add(packed)
            .ok_or_else(|| err("Tệp Excel quá lớn."))?;
        let input = src
            .get(start..end_data)
            .ok_or_else(|| err("Tệp Excel bị hỏng."))?;
        let mut output = Vec::new();
        if method == 0 {
            output.extend_from_slice(input);
        } else {
            DeflateDecoder::new(input)
                .take((MAX_XML + 1) as u64)
                .read_to_end(&mut output)
                .map_err(|_| err("Không giải nén được tệp Excel."))?;
        }
        if output.len() != unpacked || output.len() > MAX_XML {
            return Err(err("Tệp Excel có dữ liệu nén bất thường."));
        }
        inflated = inflated
            .checked_add(output.len())
            .ok_or_else(|| err("Tệp Excel quá lớn."))?;
        if inflated > 32 * 1024 * 1024 {
            return Err(err("Tệp Excel vượt giới hạn đọc an toàn."));
        }
        if result.insert(name, output).is_some() {
            return Err(err("Tệp Excel có đường dẫn trùng."));
        }
    }
    Ok(result)
}
fn attr(tag: &BytesStart<'_>, key: &[u8]) -> Option<String> {
    tag.attributes()
        .flatten()
        .find(|a| a.key.as_ref() == key)
        .map(|a| String::from_utf8_lossy(a.value.as_ref()).into_owned())
}
fn text(e: &quick_xml::events::BytesText<'_>) -> Result<String, String> {
    let raw =
        std::str::from_utf8(e.as_ref()).map_err(|_| err("Excel chứa văn bản không hợp lệ."))?;
    Ok(quick_xml::escape::unescape(raw)
        .map_err(|_| err("Excel chứa ký tự không hợp lệ."))?
        .into_owned())
}
fn shared_strings(xml: Option<&Vec<u8>>) -> Result<Vec<String>, String> {
    let Some(xml) = xml else { return Ok(vec![]) };
    let mut reader = Reader::from_reader(xml.as_slice());
    let (mut strings, mut value, mut inside) = (Vec::new(), String::new(), false);
    loop {
        match reader
            .read_event()
            .map_err(|_| err("Bảng chữ Excel bị hỏng."))?
        {
            Event::Start(e) if e.local_name().as_ref() == b"si" => {
                inside = true;
                value.clear();
            }
            Event::End(e) if e.local_name().as_ref() == b"si" => {
                strings.push(value.clone());
                inside = false;
                if strings.len() > 100_000 {
                    return Err(err("Excel có quá nhiều giá trị chữ."));
                }
            }
            Event::Text(e) if inside => {
                value.push_str(&text(&e)?);
                if value.len() > 4096 {
                    return Err(err("Một ô Excel quá dài."));
                }
            }
            Event::Eof => break,
            _ => {}
        }
    }
    Ok(strings)
}
fn column_index(address: &str) -> Option<usize> {
    let mut n = 0usize;
    let mut found = false;
    for c in address.bytes() {
        if c.is_ascii_alphabetic() {
            n = n
                .checked_mul(26)?
                .checked_add((c.to_ascii_uppercase() - b'A' + 1) as usize)?;
            found = true;
        } else {
            break;
        }
    }
    if found && n > 0 && n <= MAX_COLUMNS {
        Some(n - 1)
    } else {
        None
    }
}
fn worksheet(name: &str, xml: &[u8], strings: &[String]) -> Result<Sheet, String> {
    let mut reader = Reader::from_reader(xml);
    let (mut row_no, mut cells, mut rows) = (0usize, vec![], Vec::new());
    let (mut col, mut cell_type, mut cell, mut reading, mut formula) =
        (None::<usize>, String::new(), String::new(), false, false);
    let mut has_formulas = false;
    loop {
        match reader
            .read_event()
            .map_err(|_| err("Không đọc được trang tính Excel."))?
        {
            Event::Start(e) if e.local_name().as_ref() == b"row" => {
                row_no = attr(&e, b"r")
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(row_no + 1);
                cells = vec![];
                if row_no > MAX_ROWS {
                    return Err(err("Trang tính vượt giới hạn số dòng."));
                }
            }
            Event::Start(e) if e.local_name().as_ref() == b"c" => {
                col = attr(&e, b"r").as_deref().and_then(column_index);
                cell_type = attr(&e, b"t").unwrap_or_default();
                cell.clear();
                formula = false;
            }
            Event::Start(e)
                if e.local_name().as_ref() == b"v" || e.local_name().as_ref() == b"t" =>
            {
                reading = true
            }
            Event::End(e) if e.local_name().as_ref() == b"v" || e.local_name().as_ref() == b"t" => {
                reading = false
            }
            Event::Start(e) if e.local_name().as_ref() == b"f" => {
                formula = true;
                has_formulas = true;
            }
            Event::Text(e) if reading => {
                cell.push_str(&text(&e)?);
                if cell.len() > 4096 {
                    return Err(err("Một ô Excel quá dài."));
                }
            }
            Event::End(e) if e.local_name().as_ref() == b"c" => {
                if let Some(i) = col {
                    if i >= MAX_COLUMNS {
                        return Err(err("Trang tính có quá nhiều cột."));
                    }
                    if cells.len() <= i {
                        cells.resize(i + 1, String::new());
                    }
                    cells[i] = if formula {
                        "[CÔNG THỨC]".into()
                    } else if cell_type == "s" {
                        let id: usize = cell
                            .parse()
                            .map_err(|_| err("Mã chữ Excel không hợp lệ."))?;
                        strings
                            .get(id)
                            .cloned()
                            .ok_or_else(|| err("Excel thiếu bảng chữ."))?
                    } else {
                        cell.clone()
                    };
                }
            }
            Event::End(e) if e.local_name().as_ref() == b"row" => {
                rows.push((row_no, std::mem::take(&mut cells)));
            }
            Event::Eof => break,
            _ => {}
        }
    }
    if rows.is_empty() {
        return Err(err("Trang tính Excel không có dữ liệu."));
    }
    Ok(Sheet {
        name: name.into(),
        rows,
        has_formulas,
    })
}
fn xlsx(src: &[u8]) -> Result<Vec<Sheet>, String> {
    let entries = zip_xml_entries(src)?;
    let workbook = entries
        .get("xl/workbook.xml")
        .ok_or_else(|| err("Không tìm thấy danh sách trang tính Excel."))?;
    let rels = entries
        .get("xl/_rels/workbook.xml.rels")
        .ok_or_else(|| err("Không đọc được liên kết trang tính Excel."))?;
    let strings = shared_strings(entries.get("xl/sharedStrings.xml"))?;
    let mut links = HashMap::new();
    let mut rr = Reader::from_reader(rels.as_slice());
    loop {
        match rr
            .read_event()
            .map_err(|_| err("Danh sách trang tính không hợp lệ."))?
        {
            Event::Start(e) | Event::Empty(e) if e.local_name().as_ref() == b"Relationship" => {
                if let (Some(id), Some(target)) = (attr(&e, b"Id"), attr(&e, b"Target")) {
                    let t = target.trim_start_matches('/');
                    let normalized = if t.starts_with("xl/") {
                        t.to_string()
                    } else {
                        format!("xl/{t}")
                    };
                    if normalized.starts_with("xl/worksheets/") && !normalized.contains("..") {
                        links.insert(id, normalized);
                    }
                }
            }
            Event::Eof => break,
            _ => {}
        }
    }
    let mut reader = Reader::from_reader(workbook.as_slice());
    let mut sheets = Vec::new();
    loop {
        match reader
            .read_event()
            .map_err(|_| err("Danh sách trang tính không hợp lệ."))?
        {
            Event::Start(e) | Event::Empty(e) if e.local_name().as_ref() == b"sheet" => {
                let name = attr(&e, b"name").ok_or_else(|| err("Excel thiếu tên trang tính."))?;
                let rel = attr(&e, b"r:id").ok_or_else(|| err("Excel thiếu mã trang tính."))?;
                if let Some(path) = links.get(&rel) {
                    let xml = entries
                        .get(path)
                        .ok_or_else(|| err("Không tìm thấy nội dung trang tính."))?;
                    sheets.push(worksheet(&name, xml, &strings)?);
                    if sheets.len() > 8 {
                        return Err(err("Tệp có quá nhiều trang tính."));
                    }
                }
            }
            Event::Eof => break,
            _ => {}
        }
    }
    if sheets.is_empty() {
        return Err(err("Không tìm thấy trang tính có dữ liệu."));
    }
    Ok(sheets)
}
fn csv(src: &[u8]) -> Result<Vec<Sheet>, String> {
    let raw = std::str::from_utf8(src).map_err(|_| err("Tệp CSV phải dùng mã chữ UTF-8."))?;
    let raw = raw.trim_start_matches('\u{feff}');
    let first = raw.lines().next().unwrap_or("");
    let delimiters = [',', ';', '\t'];
    let separator = *delimiters
        .iter()
        .max_by_key(|&&c| first.matches(c).count())
        .unwrap_or(&',');
    let (mut row, mut cell, mut rows) = (Vec::new(), String::new(), Vec::new());
    let (mut quoted, mut closed, mut line) = (false, false, 1usize);
    let mut chars = raw.chars().peekable();
    while let Some(c) = chars.next() {
        if quoted {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    cell.push('"');
                    chars.next();
                } else {
                    quoted = false;
                    closed = true;
                }
            } else {
                cell.push(c);
            }
        } else if c == '"' && cell.is_empty() && !closed {
            quoted = true;
        } else if c == separator {
            row.push(std::mem::take(&mut cell));
            closed = false;
            if row.len() > MAX_COLUMNS {
                return Err(err("CSV có quá nhiều cột."));
            }
        } else if c == '\r' || c == '\n' {
            if c == '\r' && chars.peek() == Some(&'\n') {
                chars.next();
            }
            row.push(std::mem::take(&mut cell));
            closed = false;
            if row.len() > MAX_COLUMNS {
                return Err(err("CSV có quá nhiều cột."));
            }
            if row.iter().any(|v| !v.is_empty()) {
                rows.push((line, std::mem::take(&mut row)));
            } else {
                row.clear();
            }
            line += 1;
            if line > MAX_ROWS {
                return Err(err("CSV có quá nhiều dòng."));
            }
        } else if closed {
            return Err(err("CSV sai dấu nháy kép."));
        } else {
            cell.push(c);
        }
        if cell.len() > 4096 {
            return Err(err("Ô CSV quá dài."));
        }
    }
    if quoted {
        return Err(err("CSV thiếu dấu nháy kết thúc."));
    }
    if !cell.is_empty() || !row.is_empty() {
        row.push(cell);
        rows.push((line, row));
    }
    if rows.is_empty() {
        return Err(err("CSV trống."));
    }
    Ok(vec![Sheet {
        name: "CSV".into(),
        rows,
        has_formulas: false,
    }])
}
pub fn parse(name: &str, bytes: &[u8]) -> Result<Vec<Sheet>, String> {
    if bytes.is_empty() || bytes.len() > MAX_FILE {
        return Err(err("Tệp trống hoặc lớn hơn 6 MB."));
    }
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".csv") {
        csv(bytes)
    } else if lower.ends_with(".xlsx") {
        xlsx(bytes)
    } else {
        Err(err(
            "Hỗ trợ tệp .xlsx hoặc .csv. Tệp .xls cần lưu lại dạng .xlsx.",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn csv_quotes_bom_and_leading_zero() {
        let s = parse(
            "nguon.csv",
            "\u{feff}Mã;Tên;Số lượng\r\n0001;\"NPP; A\";24\r\n".as_bytes(),
        )
        .unwrap();
        assert_eq!(s[0].rows[1].1, vec!["0001", "NPP; A", "24"]);
    }
    #[test]
    fn malformed_quote_and_size_blocked() {
        assert!(parse("x.csv", b"a,b\n\"missing").is_err());
        assert!(parse("x.csv", &vec![0; MAX_FILE + 1]).is_err());
    }
    // Minimal uncompressed ZIP fixture exercises actual XLSX workbook relationship,
    // shared-string resolution and worksheet column placement without a new test dep.
    fn zip_fixture(parts: &[(&str, &str)]) -> Vec<u8> {
        let mut file = Vec::new();
        let mut directory = Vec::new();
        fn put16(out: &mut Vec<u8>, n: u16) {
            out.extend_from_slice(&n.to_le_bytes());
        }
        fn put32(out: &mut Vec<u8>, n: u32) {
            out.extend_from_slice(&n.to_le_bytes());
        }
        for (name, body) in parts {
            let offset = file.len() as u32;
            file.extend_from_slice(b"PK\x03\x04");
            for n in [20, 0, 0, 0, 0] {
                put16(&mut file, n);
            }
            for n in [0, body.len() as u32, body.len() as u32] {
                put32(&mut file, n);
            }
            put16(&mut file, name.len() as u16);
            put16(&mut file, 0);
            file.extend_from_slice(name.as_bytes());
            file.extend_from_slice(body.as_bytes());

            directory.extend_from_slice(b"PK\x01\x02");
            for n in [20, 20, 0, 0, 0, 0] {
                put16(&mut directory, n);
            }
            for n in [0, body.len() as u32, body.len() as u32] {
                put32(&mut directory, n);
            }
            put16(&mut directory, name.len() as u16);
            for _ in 0..4 {
                put16(&mut directory, 0);
            }
            put32(&mut directory, 0);
            put32(&mut directory, offset);
            directory.extend_from_slice(name.as_bytes());
        }
        let directory_at = file.len() as u32;
        file.extend_from_slice(&directory);
        file.extend_from_slice(b"PK\x05\x06");
        for n in [0, 0, parts.len() as u16, parts.len() as u16] {
            put16(&mut file, n);
        }
        put32(&mut file, directory.len() as u32);
        put32(&mut file, directory_at);
        put16(&mut file, 0);
        file
    }

    #[test]
    fn reads_xlsx_sheet_and_preserves_text_code_with_zero_prefix() {
        let zip = zip_fixture(&[
            (
                "xl/workbook.xml",
                r#"<workbook><sheets><sheet name="Bán ra" r:id="rId1"/></sheets></workbook>"#,
            ),
            (
                "xl/_rels/workbook.xml.rels",
                r#"<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>"#,
            ),
            (
                "xl/sharedStrings.xml",
                r#"<sst><si><t>Mã hàng</t></si><si><t>0007</t></si></sst>"#,
            ),
            (
                "xl/worksheets/sheet1.xml",
                r#"<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c></row></sheetData></worksheet>"#,
            ),
        ]);
        let result = parse("bán-ra.xlsx", &zip).expect("valid workbook");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "Bán ra");
        assert_eq!(result[0].rows[0].1[0], "Mã hàng");
        assert_eq!(result[0].rows[1].1[0], "0007");
    }
}
