import type { JSX } from 'solid-js';

type MainContentProps = {
  children: JSX.Element;
};

export default function MainContent(props: MainContentProps) {
  return (
    <main class="app-main">
      <div class="app-main__scroller">
        {props.children}
      </div>
    </main>
  );
}
