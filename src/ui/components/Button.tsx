import type { JSX } from 'solid-js';
import './components.css';

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

export function Button(props: ButtonProps) {
  const variant = () => props.variant || 'primary';
  const size = () => props.size || 'md';
  const className = () => [
    'ld-button',
    `ld-button--${variant()}`,
    size() !== 'md' ? `ld-button--${size()}` : '',
    props.class || ''
  ].filter(Boolean).join(' ');

  return (
    <button
      {...props}
      class={className()}
      type={props.type || 'button'}
    />
  );
}
