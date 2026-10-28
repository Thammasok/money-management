import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorList } from './ErrorList';

// Boundary under test: ErrorList's props — every message of a failed request, one line each, in one alert.

describe('ErrorList', () => {
  it('shows every message, one line each, in the order given, in one alert with the given id', () => {
    // Arrange & Act
    render(
      <ErrorList
        id="demo-error"
        messages={['Enter a wallet name.', 'Opening balance is too large.']}
      />,
    );

    // Assert
    const alert = screen.getByRole('alert');
    expect(alert).toBe(screen.getByTestId('demo-error'));
    expect(Array.from(alert.querySelectorAll('p')).map((line) => line.textContent)).toEqual([
      'Enter a wallet name.',
      'Opening balance is too large.',
    ]);
  });

  it('shows no alert at all when there is nothing to say', () => {
    // Arrange & Act
    render(<ErrorList id="demo-error" messages={[]} />);

    // Assert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a message twice if it was sent twice, without a duplicate-key warning', () => {
    // Arrange
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    render(<ErrorList id="demo-error" messages={['Same.', 'Same.']} />);

    // Assert
    expect(screen.getAllByText('Same.')).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('takes focus when it appears, like every alert', () => {
    // Arrange & Act
    render(<ErrorList id="demo-error" messages={['Something went wrong.']} />);

    // Assert
    expect(screen.getByRole('alert')).toHaveFocus();
  });
});
