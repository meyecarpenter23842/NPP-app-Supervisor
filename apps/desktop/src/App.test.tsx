import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

describe('M1.1 placeholder', () => {
  it('states that business data is not available', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Sales Supervisor');
    expect(html).toContain('Chưa có dữ liệu');
    expect(html).toContain('M1.1');
  });
});
