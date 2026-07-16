import './components.css';

type LoudaraLoaderProps = {
  label?: string;
  class?: string;
};

export function LoudaraLoader(props: LoudaraLoaderProps) {
  const className = () => ['ld-loader', props.class || ''].filter(Boolean).join(' ');

  return (
    <div class={className()} role="status" aria-live="polite">
      <span class="ld-loader__mark" aria-hidden="true" />
      <span class="ld-loader__label">{props.label || 'Loading Loudara'}</span>
    </div>
  );
}
