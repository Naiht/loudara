import { Show } from 'solid-js';
import type { JSX } from 'solid-js';
import './components.css';

type InputProps = JSX.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helperText?: string;
};

export function Input(props: InputProps) {
  const inputId = () => props.id || props.name || `ld-input-${props.label?.replace(/\s+/g, '-').toLowerCase() || 'field'}`;
  const className = () => ['ld-input', props.class || ''].filter(Boolean).join(' ');

  return (
    <label class="ld-input-field" for={inputId()}>
      <Show when={props.label}>
        <span class="ld-input-field__label">{props.label}</span>
      </Show>
      <input
        {...props}
        id={inputId()}
        class={className()}
      />
      <Show when={props.helperText}>
        <span class="ld-input-field__helper">{props.helperText}</span>
      </Show>
    </label>
  );
}
