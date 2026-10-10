import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';
import Onboarding from './components/Onboarding';
import Workspace from './components/Workspace';
import BusinessContent from './components/BusinessContent';
import { businessPages, businessGroups, getDefaultView, getValidView } from './components/pageModel';

const operator = { displayName: 'Nguyễn Văn A', role: 'SALES' as const };

describe('M1.5 sidebar navigation and business screens', () => {
  it('shows 10 business pages and no Settings in sidebar', () => {
    expect(businessPages).toHaveLength(10);
    expect(new Set(businessPages.map((page) => page.id)).size).toBe(10);
    expect(businessGroups).toEqual(['TỔNG QUAN', 'KINH DOANH', 'QUẢN TRỊ']);
    const html = renderToStaticMarkup(<Workspace operator={operator} onUpdate={async () => {}} />);
    const nav = html.match(/<nav[^>]*aria-label="Điều hướng nghiệp vụ"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
    expect(nav).not.toBe('');
    expect((nav.match(/class="nav-item/g) ?? [])).toHaveLength(10);
    expect(nav).not.toContain('Cài đặt');
    expect(html).toContain('Hồ sơ &amp; Cài đặt');
    expect(html).toContain('Nguyễn Văn A');
    expect(html).toContain('aria-current="page"');
  });

  it('keeps meaningful accessible sub-navigation per business page', () => {
    for (const page of businessPages) {
      expect(page.views.length).toBeGreaterThanOrEqual(3);
      expect(getDefaultView(page.id)).toBe(page.views[0]);
      for (const view of page.views) expect(getValidView(page.id, view)).toBe(view);
      expect(getValidView(page.id, 'không có')).toBe(page.views[0]);
      const html = renderToStaticMarkup(<BusinessContent pageId={page.id} view={page.views[0]} onGoToImport={() => {}} />);
      expect(html.length).toBeGreaterThan(250);
      expect(html).not.toContain('12,4 tỷ');
      expect(html).not.toContain('Lorem ipsum');
    }
  });

  it('renders every sub-screen with source-aware empty states, without invented KPIs', () => {
    for (const page of businessPages) {
      for (const view of page.views) {
        const html = renderToStaticMarkup(<BusinessContent pageId={page.id} view={view} onGoToImport={() => {}} />);
        expect(html).toMatch(/Chưa|chưa|nguồn|Nguồn/);
        expect(html).not.toContain('12,4 tỷ');
        expect(html).not.toContain('Đã xuất file thành công');
      }
    }
  });

  it('preserves a loading state and one local operator onboarding with all 3 roles', () => {
    const appHtml = renderToStaticMarkup(<App />);
    expect(appHtml).toContain('Đang mở dữ liệu trên máy');
    const onboardingHtml = renderToStaticMarkup(<Onboarding onCreate={async () => {}} />);
    expect(onboardingHtml).toContain('một hồ sơ');
    for (const role of ['Sales', 'SUP', 'ASM']) expect(onboardingHtml).toContain(role);
    expect(onboardingHtml).not.toContain('mật khẩu mới');
  });

  it('keeps operator editing in settings and marks unrelated M4 capabilities unsupported', () => {
    const src = renderToStaticMarkup(<Workspace operator={operator} onUpdate={async () => {}} />);
    expect(src).toContain('Bộ lọc sẽ khả dụng khi có dữ liệu');
    expect(src).toContain('role="tablist"');
    expect(src).toContain('role="tabpanel"');
    expect(src).toContain('aria-selected="true"');
    expect(src).toContain('disabled=""');
  });
});
