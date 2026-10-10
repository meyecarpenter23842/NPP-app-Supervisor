import { useState, type FormEvent } from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody, Radio, RadioGroup, Spinner, Text } from '@fluentui/react-components';
import { normalizeIpcError, type OperatorInput, type OperatorRole } from '../ipc';

interface Props {
  initial?: OperatorInput;
  submitLabel: string;
  onSubmit: (operator: OperatorInput) => Promise<void>;
}
const options: Array<{ role: OperatorRole; title: string; subtitle: string }> = [
  { role: 'SALES', title: 'Sales', subtitle: 'Theo dõi kết quả kinh doanh cá nhân' },
  { role: 'SUP', title: 'SUP', subtitle: 'Theo dõi đội ngũ và nhà phân phối phụ trách' },
  { role: 'ASM', title: 'ASM', subtitle: 'Theo dõi toàn khu vực được cấu hình' },
];

export default function OperatorForm({ initial, submitLabel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.displayName ?? '');
  const [role, setRole] = useState<OperatorRole>(initial?.role ?? 'SUP');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setError('Tên người sử dụng cần từ 2 đến 80 ký tự.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ displayName: trimmed, role });
    } catch (reason) {
      setError(normalizeIpcError(reason).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="operator-form" onSubmit={(event) => { void submit(event); }}>
      <Field label="Tên người sử dụng" hint="Thông tin chỉ được lưu trên máy này." required>
        <Input value={name} onChange={(_, data) => setName(data.value)}
          maxLength={80} autoComplete="name" disabled={busy}
          placeholder="Ví dụ: Nguyễn Văn A" />
      </Field>
      <Field label="Vị trí công việc" hint="Chỉ thay đổi góc nhìn quản lý; không tạo tài khoản khác." required>
        <RadioGroup className="role-options" value={role} onChange={(_, data) => setRole(data.value as OperatorRole)}
          disabled={busy} layout="vertical">
          {options.map((item) => (
            <div className="role-option" key={item.role}>
              <Radio value={item.role} label={item.title} />
              <Text size={200} className="role-hint">{item.subtitle}</Text>
            </div>
          ))}
        </RadioGroup>
      </Field>
      {error ? <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar> : null}
      <Button type="submit" appearance="primary" disabled={busy || name.trim().length < 2}>
        {busy ? <Spinner size="tiny" aria-label="Đang lưu" /> : submitLabel}
      </Button>
    </form>
  );
}
