import { Badge, Card, Text, Title2 } from '@fluentui/react-components';
import OperatorForm from './OperatorForm';
import type { OperatorInput } from '../ipc';

export default function Onboarding({ onCreate }: { onCreate: (input: OperatorInput) => Promise<void> }) {
  return (
    <main className="onboarding-layout">
      <section className="intro-panel">
        <div className="app-mark" aria-hidden="true">SC</div>
        <Badge appearance="filled" color="informative">Khởi tạo lần đầu</Badge>
        <Text as="h1" size={600} weight="semibold">Sales Supervisor</Text>
        <Text size={400}>
          Không gian phân tích kinh doanh cho Sales, SUP và ASM.
          Dữ liệu nghiệp vụ được lưu trên máy tính của bạn.
        </Text>
        <div className="intro-points">
          <Text>01 người sử dụng trên mỗi bộ dữ liệu</Text>
          <Text>Không yêu cầu tạo mật khẩu hoặc tài khoản cho nhân viên cấp dưới</Text>
          <Text>Chưa có dữ liệu kinh doanh cho đến khi nhập Excel</Text>
        </div>
      </section>
      <Card className="onboarding-card">
        <div className="section-heading">
          <Text size={200} weight="semibold" className="eyebrow">BƯỚC 01 · HỒ SƠ CỤC BỘ</Text>
          <Title2>Thiết lập người sử dụng</Title2>
          <Text>Chỉ tạo một hồ sơ cho người trực tiếp sử dụng ứng dụng.</Text>
        </div>
        <OperatorForm submitLabel="Bắt đầu sử dụng" onSubmit={onCreate} />
      </Card>
    </main>
  );
}
