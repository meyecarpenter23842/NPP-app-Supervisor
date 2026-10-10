import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';
import Onboarding from './components/Onboarding';
import Workspace from './components/Workspace';

describe('M1.3 local operator flow and placeholder UX', () => {
  it('shows a loading state while reading the native database', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Đang mở dữ liệu trên máy');
    expect(html).not.toContain('12,4 tỷ');
  });

  it('explains singleton onboarding and all three supported roles', () => {
    const html = renderToStaticMarkup(<Onboarding onCreate={async () => {}} />);
    expect(html).toContain('một hồ sơ');
    for (const role of ['Sales', 'SUP', 'ASM']) expect(html).toContain(role);
    expect(html).not.toContain('mật khẩu mới');
  });

  it('renders office navigation, empty source state and settings without fictitious KPI', () => {
    const html = renderToStaticMarkup(<Workspace operator={{ displayName: 'Nguyễn Văn A', role: 'SALES' }} onUpdate={async () => {}} />);
    expect(html).toContain('Nhà phân phối');
    expect(html).toContain('Xuất nhập tồn');
    expect(html).toContain('Chưa có dữ liệu');
    expect(html).toContain('Nguyễn Văn A');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('12,4 tỷ');
  });
});
