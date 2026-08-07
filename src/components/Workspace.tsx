"use client";

import { useEffect, useState } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { PanelLeftNavigation } from "./PanelLeftNavigation";
import { PanelCenterReader } from "./PanelCenterReader";
import { PanelRightAnalysis } from "./PanelRightAnalysis";

const PANEL_IDS = ["nav", "reader", "analysis"];

function WorkspacePanels() {
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: "alethia-workspace",
    panelIds: PANEL_IDS,
  });
  return (
    <Group
      id="alethia-workspace"
      defaultLayout={defaultLayout}
      onLayoutChange={onLayoutChange}
      className="h-full w-full"
    >
      <Panel id="nav" defaultSize={18} minSize={12} collapsible>
        <PanelLeftNavigation />
      </Panel>
      <Separator
        id="nav-sep"
        className="w-px bg-border transition-colors hover:bg-primary data-separator:hover:bg-primary data-separator:active:bg-primary"
      />
      <Panel id="reader" defaultSize={56} minSize={30}>
        <PanelCenterReader />
      </Panel>
      <Separator
        id="reader-sep"
        className="w-px bg-border transition-colors hover:bg-primary data-separator:hover:bg-primary data-separator:active:bg-primary"
      />
      <Panel id="analysis" defaultSize={26} minSize={18} collapsible>
        <PanelRightAnalysis />
      </Panel>
    </Group>
  );
}

/**
 * Workspace de 3 paneles. Se monta solo en el cliente: react-resizable-panels v4
 * lee localStorage en render (persistencia de layout), lo que rompe el SSR.
 * El gate de montaje también evita discrepancias de hidratación.
 */
export function Workspace() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() => setMounted(true));
  }, []);
  if (!mounted) return <div className="flex h-full w-full flex-1" />;
  return <WorkspacePanels />;
}
