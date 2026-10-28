import type { TextFieldProps } from './component-props';

/** Humble: a label over an input, with optional help text under it. Every form is built from this. */
export function TextField({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  hint,
  name = type,
  inputMode,
  max,
  ref,
}: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={false}
        max={max}
        aria-describedby={hint?.id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input input-lg w-full border-base-content/60"
      />
      {hint ? (
        <p id={hint.id} className="text-sm text-base-content/70">
          {hint.text}
        </p>
      ) : null}
    </div>
  );
}
