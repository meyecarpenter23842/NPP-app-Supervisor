import { useEffect, useState } from 'react';
import { FluentProvider, Spinner, Text, Button, webLightTheme } from '@fluentui/react-components';
import { desktopApi, normalizeIpcError, type LocalOperator, type OperatorInput } from './ipc';
import Onboarding from './components/Onboarding';
import Workspace from './components/Workspace';

export default function App() {
  const [operator, setOperator] = useState<LocalOperator | null | undefined>(undefined);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    async function start() {
      try {
        const health = await desktopApi.health();
        if (!health.storageReady || health.status !== 'ready') {
          throw new Error('Storage not initialized');
        }
        const saved = await desktopApi.getOperator();
        if (live) {
          setOperator(saved);
          setStartupError(null);
        }
      } catch (reason) {
        if (live) setStartupError(normalizeIpcError(reason).message);
      }
    }
    void start();
    return () => { live = false; };
  }, [retry]);

  async function create(input: OperatorInput) {
    const created = await desktopApi.createOperator(input);
    setOperator(created);
  }

  async function update(input: OperatorInput) {
    const saved = await desktopApi.updateOperator(input);
    setOperator(saved);
  }

  return (
    <FluentProvider theme={webLightTheme} className="app-provider">
      {startupError ? (
        <main className="center-stage" aria-live="assertive">
          <section className="startup-error">
            <Text as="h1" size={500} weight="semibold">Không thể mở dữ liệu trên máy</Text>
            <Text>{startupError}</Text>
            <Button appearance="primary" onClick={() => {
              setStartupError(null);
              setOperator(undefined);
              setRetry((current) => current + 1);
            }}>Thử lại</Button>
          </section>
        </main>
      ) : operator === undefined ? (
        <main className="center-stage" aria-live="polite">
          <Spinner label="Đang mở dữ liệu trên máy..." size="large" />
        </main>
      ) : operator === null ? (
        <Onboarding onCreate={create} />
      ) : (
        <Workspace operator={operator} onUpdate={update} />
      )}
    </FluentProvider>
  );
}
