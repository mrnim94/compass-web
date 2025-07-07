import React from 'react';
import { registerHadronPlugin } from 'hadron-app-registry';
import ImportModal from './import-modal';
import ImportInProgressModal from '../../compass/packages/compass-import-export/src/components/import-in-progress-modal';
import { activatePlugin } from '../../compass/packages/compass-import-export/src/stores/import-store';
import { preferencesLocator } from '../../compass/packages/compass-preferences-model/provider';
import { createLoggerLocator } from '@mongodb-js/compass-logging/provider';
import { telemetryLocator } from '@mongodb-js/compass-telemetry/provider';
import { connectionsLocator } from '@mongodb-js/compass-connections/provider';
import { workspacesServiceLocator } from '../../compass/packages/compass-workspaces/provider';

function ImportComponent() {
  return (
    <>
      <ImportModal />
      <ImportInProgressModal />
    </>
  );
}

// @ts-ignore
export const ImportPlugin = registerHadronPlugin(
  {
    name: 'Import',
    component: ImportComponent,
    activate: activatePlugin,
  },
  {
    connections: connectionsLocator,
    workspaces: workspacesServiceLocator,
    preferences: preferencesLocator,
    logger: createLoggerLocator('COMPASS-IMPORT-UI'),
    track: telemetryLocator,
  }
);

export default ImportPlugin;
