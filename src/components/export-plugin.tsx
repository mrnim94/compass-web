import React from 'react';
import { registerHadronPlugin } from 'hadron-app-registry';
import { activatePlugin } from '../../compass/packages/compass-import-export/src/stores/export-store';
import { preferencesLocator } from '../../compass/packages/compass-preferences-model/provider';
import { createLoggerLocator } from '@mongodb-js/compass-logging/provider';
import { telemetryLocator } from '@mongodb-js/compass-telemetry/provider';
import { connectionsLocator } from '@mongodb-js/compass-connections/provider';
import { ExportModal } from './export-modal';
import ExportInProgressModal from '../../compass/packages/compass-import-export/src/components/export-in-progress-modal';

function ExportComponent() {
  return (
    <>
      <ExportModal />
      <ExportInProgressModal />
    </>
  );
}

// @ts-ignore
export const ExportPlugin = registerHadronPlugin(
  {
    name: 'Export',
    component: ExportComponent,
    activate: activatePlugin,
  },
  {
    connections: connectionsLocator,
    preferences: preferencesLocator,
    logger: createLoggerLocator('COMPASS-EXPORT-UI'),
    track: telemetryLocator,
  }
);
