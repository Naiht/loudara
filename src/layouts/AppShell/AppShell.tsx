import type { JSX } from 'solid-js';
import { createSignal } from 'solid-js';
import Header from './Header';
import MainContent from './MainContent';
import PlayerBar from './PlayerBar';
import Sidebar from './Sidebar';
import './AppShell.css';

type AppShellProps = {
  children: JSX.Element;
};

export default function AppShell(props: AppShellProps) {
  const [collapsed, setCollapsed] = createSignal(false);

  return (
    <div
      class="app-shell loudara-theme"
      classList={{ 'app-shell--collapsed': collapsed() }}
    >
      <Sidebar
        collapsed={collapsed()}
        onToggleSidebar={() => setCollapsed(value => !value)}
      />
      <Header />
      <MainContent>
        {props.children}
      </MainContent>
      <PlayerBar />
    </div>
  );
}
