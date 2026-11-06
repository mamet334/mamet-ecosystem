import React, { lazy, Suspense } from 'react';
import { WorkspaceProvider } from '../workspaces/WorkspaceContext';
import AppShell from '../../components/workbench/AppShell';

const ModuleSuspenseWrapper = React.memo(function ModuleSuspenseWrapper({ component: Component, ...props }) {
  return React.createElement(
    Suspense,
    { fallback: React.createElement('div', { className: 'p-4 text-emerald-500 font-mono text-xs' }, 'Loading Module...') },
    React.createElement(Component, props)
  );
});

const GenericAppWrapper = ({ appId, workspaceId, mainPanel: MainPanel }) => {
  const mainPanelRef = React.useRef(null);
  if (!mainPanelRef.current) {
    mainPanelRef.current = (props) => React.createElement(ModuleSuspenseWrapper, { component: MainPanel, ...props });
  }

  return React.createElement(WorkspaceProvider, { appId, defaultWorkspaceId: workspaceId },
    React.createElement(AppShell, { mainPanel: mainPanelRef.current })
  );
};

const lazyWithWrapper = (importFunc) => {
  const LazyComponent = lazy(importFunc);
  return (props) => React.createElement(GenericAppWrapper, { ...props, mainPanel: LazyComponent });
};

export const AppComponents = {
  'HomeDashboard': lazy(() => import('../../components/dashboard/HomeDashboard')),
  'ConversationEngine': lazyWithWrapper(() => import('../../components/workbench/ConversationEngine')),
  'AgentForge': lazy(() => import('../../components/agent-forge/AgentForge')),
  'ResearchApp': lazy(() => import('../../components/research/ResearchApp')),
  'MemoryApp': lazy(() => import('../../components/memory/MemoryApp')),
  'FileExplorer': lazy(() => import('../../components/explorer/FileExplorer')),
  'Settings': lazy(() => import('../../components/Settings')),
  'SystemLogsApp': lazy(() => import('../../components/system/SystemLogsApp')),
  'BillingDashboard': lazy(() => import('../../components/BillingDashboard')),

  'EngineeringTasksWidget': lazy(() => import('../../components/widgets/EngineeringTasksWidget')),
  'ArchitectureGapsWidget': lazy(() => import('../../components/widgets/ArchitectureGapsWidget')),
  'VerificationLogWidget': lazy(() => import('../../components/widgets/VerificationLogWidget')),
  'WorkspaceNavWidget': lazy(() => import('../../components/widgets/WorkspaceNavWidget')),
  'MaefExecutionMonitorWidget': lazy(() => import('../../components/widgets/MaefExecutionMonitorWidget')),
  'DisasterRecoveryWidget': lazy(() => import('../../components/widgets/DisasterRecoveryWidget'))
};
