import './components.css';

type SpinnerProps = {
  label?: string;
  class?: string;
};

export function Spinner(props: SpinnerProps) {
  const className = () => ['ld-spinner', props.class || ''].filter(Boolean).join(' ');

  return (
    <span
      aria-label={props.label || 'Loading'}
      class={className()}
      role="status"
    />
  );
}
