import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageHeading } from './PageHeading';

// Boundary under test: PageHeading's props — the screen's title as heading, as document title, and as the focus target
// on arrival (a route change in a single-page app does not move focus by itself).

describe('PageHeading', () => {
  afterEach(() => {
    document.title = '';
  });

  it('renders the title as the level-one heading', () => {
    // Arrange & Act
    render(<PageHeading>Sign in</PageHeading>);

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });

  it('puts the title in the document title, behind the app name', () => {
    // Arrange & Act
    render(<PageHeading>Sign in</PageHeading>);

    // Assert
    expect(document.title).toBe('Sign in · Money Management');
  });

  it('takes focus when the screen arrives, so the new screen is announced and Tab starts inside it', () => {
    // Arrange & Act
    render(<PageHeading>Home</PageHeading>);

    // Assert
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('does not take focus back when it is re-rendered while the person is typing elsewhere', () => {
    // Arrange
    const { rerender } = render(
      <>
        <PageHeading>Sign in</PageHeading>
        <input id="elsewhere" />
      </>,
    );
    screen.getByTestId('elsewhere').focus();

    // Act
    rerender(
      <>
        <PageHeading>Sign in</PageHeading>
        <input id="elsewhere" />
      </>,
    );

    // Assert
    expect(screen.getByTestId('elsewhere')).toHaveFocus();
  });
});
