import { Badge, Card, FluentProvider, Text, Title2, webLightTheme } from '@fluentui/react-components';

export default function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <div className="shell">
        <header className="topbar">
          <Text as="h1" size={500} weight="semibold">Sales Supervisor</Text>
          <Badge appearance="outline">Desktop foundation</Badge>
        </header>
        <main className="content" id="main-content">
          <Card className="welcome" appearance="filled-alternative">
            <Title2>Khung ứng dụng Windows</Title2>
            <Text>Đây là giao diện nền offline. Chưa có dữ liệu nghiệp vụ, chức năng nhập Excel hoặc báo cáo.</Text>
            <Text size={200}>M1.1 · Tauri 2 · React · Fluent UI 9</Text>
          </Card>
        </main>
      </div>
    </FluentProvider>
  );
}
