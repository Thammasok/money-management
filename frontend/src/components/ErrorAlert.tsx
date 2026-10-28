import type { ErrorAlertProps } from './component-props';
import { focusOnMount } from './focus-on-mount';

const BASE_CLASSES = 'alert alert-error text-base';

/** Humble: an error the person must notice — announced (`role="alert"`) and focused the moment it appears. */
export function ErrorAlert({ id, className, children }: ErrorAlertProps) {
  return (
    <div
      id={id}
      role="alert"
      tabIndex={-1}
      ref={focusOnMount}
      className={className ? `${BASE_CLASSES} ${className}` : BASE_CLASSES}
    >
      {children}
    </div>
  );
}
