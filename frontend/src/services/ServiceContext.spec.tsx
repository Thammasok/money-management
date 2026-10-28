import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IAuthService } from './auth/auth.types';
import { ServiceProvider, useServices } from './ServiceContext';
import type { Services } from './services';

// Boundary under test: ServiceProvider / useServices — how a screen gets the services it was given.

function aServices(): Services {
  const authService: IAuthService = {
    getCurrentUser: vi.fn(),
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
  return { authService };
}

function WhichServices({ expected }: { expected: Services }) {
  const services = useServices();
  return <p id="probe">{services === expected ? 'the provided services' : 'other services'}</p>;
}

describe('useServices', () => {
  it('gives a screen the services of the nearest ServiceProvider', () => {
    // Arrange
    const services = aServices();

    // Act
    render(
      <ServiceProvider services={services}>
        <WhichServices expected={services} />
      </ServiceProvider>,
    );

    // Assert
    expect(screen.getByTestId('probe')).toHaveTextContent('the provided services');
  });

  it('refuses to run outside a ServiceProvider instead of failing later with a vague error', () => {
    // Arrange
    const quietConsole = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    const renderWithoutProvider = () => render(<WhichServices expected={aServices()} />);

    // Assert
    expect(renderWithoutProvider).toThrow('useServices must be used inside a <ServiceProvider>');
    quietConsole.mockRestore();
  });
});
