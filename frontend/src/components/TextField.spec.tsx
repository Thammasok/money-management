import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TextFieldProps } from './component-props';
import { TextField } from './TextField';

// Boundary under test: TextField's props — the one labelled input both forms are made of.

function renderField(props: Partial<TextFieldProps> = {}) {
  const onChange = vi.fn<TextFieldProps['onChange']>();
  const { container } = render(
    <TextField
      id="demo-email"
      label="Email"
      type="email"
      autoComplete="email"
      value=""
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, container, user: userEvent.setup() };
}

describe('TextField', () => {
  it('renders a labelled input with the given id, type and autocomplete hint', () => {
    // Arrange & Act
    renderField({ type: 'password', autoComplete: 'new-password' });

    // Assert
    const input = screen.getByLabelText('Email');
    expect(input).toBe(screen.getByTestId('demo-email'));
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
  });

  it('shows the value it is given', () => {
    // Arrange & Act
    renderField({ value: 'me@example.test' });

    // Assert
    expect(screen.getByTestId('demo-email')).toHaveValue('me@example.test');
  });

  it('reports what the person types, one character at a time', async () => {
    // Arrange
    const { onChange, user } = renderField();

    // Act
    await user.type(screen.getByTestId('demo-email'), 'ab');

    // Assert
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(['a', 'b']);
  });

  it('shows no hint unless given one', () => {
    // Arrange & Act
    const { container } = renderField();

    // Assert
    expect(screen.getByTestId('demo-email')).not.toHaveAttribute('aria-describedby');
    expect(container.querySelector('p')).toBeNull();
  });

  it('shows a hint under the input and ties it to the input for assistive technology', () => {
    // Arrange & Act
    renderField({ hint: { id: 'demo-hint', text: 'Use your work address.' } });

    // Assert
    expect(screen.getByTestId('demo-hint')).toHaveTextContent('Use your work address.');
    expect(screen.getByTestId('demo-email')).toHaveAccessibleDescription('Use your work address.');
  });

  it.each(['text', 'date'] as const)('renders a %s input too', (type) => {
    // Arrange & Act
    renderField({ type });

    // Assert
    expect(screen.getByTestId('demo-email')).toHaveAttribute('type', type);
  });

  it('names the input after its type unless it is given a name', () => {
    // Arrange & Act
    renderField({ type: 'password' });

    // Assert
    expect(screen.getByTestId('demo-email')).toHaveAttribute('name', 'password');
  });

  it('uses the name it is given', () => {
    // Arrange & Act
    renderField({ type: 'text', name: 'openingBalance' });

    // Assert
    expect(screen.getByTestId('demo-email')).toHaveAttribute('name', 'openingBalance');
  });

  it('offers a decimal keyboard for a number typed as text', () => {
    // Arrange & Act
    renderField({ type: 'text', inputMode: 'decimal' });

    // Assert
    expect(screen.getByTestId('demo-email')).toHaveAttribute('inputmode', 'decimal');
  });

  it('limits a date field to the latest date it is given', () => {
    // Arrange & Act
    renderField({ type: 'date', max: '2026-10-29' });

    // Assert
    expect(screen.getByTestId('demo-email')).toHaveAttribute('max', '2026-10-29');
  });

  it('lets its owner move focus into the input', () => {
    // Arrange
    const ref = createRef<HTMLInputElement>();
    renderField({ ref });

    // Act
    ref.current?.focus();

    // Assert
    expect(screen.getByTestId('demo-email')).toHaveFocus();
  });
});
