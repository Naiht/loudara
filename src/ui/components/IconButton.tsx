import type { JSX } from 'solid-js';
import './components.css';

type IconButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export function IconButton(props: IconButtonProps) {
  const className = () => ['ld-icon-button', props.class || ''].filter(Boolean).join(' ');

  return (
    <button
      {...props}
      aria-label={props['aria-label'] || props.label}
      class={className()}
      title={props.title || props.label}
      type={props.type || 'button'}
    />
  );
}
