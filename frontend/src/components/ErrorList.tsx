import type { ErrorListProps } from './component-props';
import { ErrorAlert } from './ErrorAlert';

/** Humble: every message of a failed request, one line each, in one alert. Nothing is rendered when there are none. */
export function ErrorList({ id, messages }: ErrorListProps) {
  if (messages.length === 0) return null;
  return (
    <ErrorAlert id={id} className="alert-vertical justify-items-start gap-2 text-start">
      {messages.map((message, index) => (
        <p key={`${index}:${message}`}>{message}</p>
      ))}
    </ErrorAlert>
  );
}
