import type { JSX } from 'solid-js';
import './components.css';

type TooltipProps = {
  content: string;
  children: JSX.Element;
  class?: string;
};

let tooltipId = 0;

export function Tooltip(props: TooltipProps) {
  const id = `ld-tooltip-${++tooltipId}`;
  const className = () => ['ld-tooltip', props.class || ''].filter(Boolean).join(' ');

  return (
    <span class={className()} aria-describedby={id}>
      {props.children}
      <span class="ld-tooltip__bubble" id={id} role="tooltip">
        {props.content}
      </span>
    </span>
  );
}
