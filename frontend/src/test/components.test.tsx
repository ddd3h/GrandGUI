import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusWidget } from '../components/widgets/StatusWidget';
import { useTelemetryStore } from '../stores/telemetryStore';

// Mock ECharts to avoid canvas issues
vi.mock('echarts', () => ({
  init: vi.fn().mockReturnValue({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  }),
}));

describe('StatusWidget', () => {
  it('renders without data', () => {
    useTelemetryStore.setState({ latest: null });
    render(<StatusWidget />);
    const dashes = screen.getAllByText('---');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows values when data is present', () => {
    useTelemetryStore.setState({
      latest: {
        id: 1,
        received_at: new Date().toISOString(),
        mode: 'active',
        battery: 'Full',
        logging_status: 'ON',
        wifi_status: 'OK',
        gnss_status: 'lock',
      },
    });
    render(<StatusWidget />);
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('lock')).toBeInTheDocument();
  });
});
