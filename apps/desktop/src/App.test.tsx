import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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
    expect(src).toContain('Chưa có dữ liệu để lọc');
    expect(src).not.toContain('QUẢN LÝ PHÂN PHỐI /');
    expect(src).toContain('role="tablist"');
    expect(src).toContain('role="tabpanel"');
    expect(src).toContain('aria-selected="true"');
    expect(src).toContain('disabled=""');
  });
});


describe('M1.6 compact desktop visual contract', () => {
  const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

  it('separates dark sidebar from the light workspace and keeps keyboard focus visible', () => {
    expect(styles).toMatch(/\.sidebar\s*\{[^}]*background:\s*var\(--sidebar-bg\)/);
    expect(styles).toMatch(/\.nav-item\.selected\s*\{[^}]*background:\s*#e6f2fc/);
    expect(styles).toMatch(/\.nav-item:focus-visible\s*\{[^}]*outline:\s*2px/);
  });

  it('keeps the header and period/NPP filters compact with a narrow-window fallback', () => {
    expect(styles).toMatch(/\.page-header\s*\{[^}]*margin-bottom:\s*11px/);
    expect(styles).toMatch(/\.page-toolbar\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(styles).toMatch(/\.filter-field\s*\{[^}]*display:\s*flex/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*540px\)/);
  });

  it('preserves actual missing-data and unsupported messages without fictional data', () => {
    const html = renderToStaticMarkup(<Workspace operator={operator} onUpdate={async () => {}} />);
    expect(html).toContain('Chưa có dữ liệu để lọc');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('12,4 tỷ');
  });
});
