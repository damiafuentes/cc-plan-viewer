import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanHeader } from './PlanHeader';

describe('PlanHeader', () => {
  it('renders the title as h1', () => {
    render(<PlanHeader title="My Plan" filename="my-plan.md" connected={true} />);
    expect(screen.getByRole('heading', { level: 1, name: 'My Plan' })).toBeInTheDocument();
  });

  it('renders humanized filename', () => {
    render(<PlanHeader title="Title" filename="my-cool-plan.md" connected={true} />);
    expect(screen.getByText('My Cool Plan')).toBeInTheDocument();
  });

  it('shows Plan Review label', () => {
    render(<PlanHeader title="Title" filename="test.md" connected={true} />);
    expect(screen.getByText('Plan Review')).toBeInTheDocument();
  });

  it('shows Live title when connected', () => {
    render(<PlanHeader title="Title" filename="test.md" connected={true} />);
    expect(screen.getByTitle('Live')).toBeInTheDocument();
  });

  it('shows Disconnected title when not connected', () => {
    render(<PlanHeader title="Title" filename="test.md" connected={false} />);
    expect(screen.getByTitle('Disconnected')).toBeInTheDocument();
  });

  it('humanizes underscores and dashes in filename', () => {
    render(<PlanHeader title="Title" filename="my_plan-name.md" connected={true} />);
    expect(screen.getByText('My Plan Name')).toBeInTheDocument();
  });
});
