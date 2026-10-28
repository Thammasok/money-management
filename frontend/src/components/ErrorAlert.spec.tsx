import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorAlert } from './ErrorAlert';

// Boundary under test: ErrorAlert's props — an error the person must notice, announced and focused when it appears.

describe('ErrorAlert', () => {
  it('shows its message in an alert with the given id', () => {
    // Arrange & Act
    render(<ErrorAlert id="demo-error">Email or password is incorrect.</ErrorAlert>);

    // Assert
    const alert = screen.getByRole('alert');
    expect(alert).toBe(screen.getByTestId('demo-error'));
    expect(alert).toHaveTextContent(/^Email or password is incorrect\.$/);
  });

  it('takes focus when it appears, so keyboard and screen-reader users land on the error', () => {
    // Arrange & Act
    render(<ErrorAlert id="demo-error">Something went wrong.</ErrorAlert>);

    // Assert
    expect(screen.getByRole('alert')).toHaveFocus();
  });

  it('does not take focus back when it is re-rendered while the person is typing elsewhere', () => {
    // Arrange
    const { rerender } = render(
      <>
        <input id="elsewhere" />
        <ErrorAlert id="demo-error">First message.</ErrorAlert>
      </>,
    );
    screen.getByTestId('elsewhere').focus();

    // Act
    rerender(
      <>
        <input id="elsewhere" />
        <ErrorAlert id="demo-error">Second message.</ErrorAlert>
      </>,
    );

    // Assert
    expect(screen.getByTestId('elsewhere')).toHaveFocus();
  });
});
