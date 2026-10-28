import { createContext, useContext, type ReactNode } from 'react';
import type { Services } from './services';

const ServiceContext = createContext<Services | null>(null);

/** Dependency injection for the screens: the root provides the real services, a test provides mocks. */
export function ServiceProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <ServiceContext value={services}>{children}</ServiceContext>;
}

export function useServices(): Services {
  const services = useContext(ServiceContext);
  if (services === null) {
    throw new Error('useServices must be used inside a <ServiceProvider>');
  }
  return services;
}
