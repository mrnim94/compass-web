import React from 'react';
import { registerHadronPlugin } from '../../compass/packages/hadron-app-registry/src';
import ImportModal from './import-modal';
import ImportInProgressModal from '../../compass/packages/compass-import-export/src/components/import-in-progress-modal';
import { activatePlugin } from '../../compass/packages/compass-import-export/src/stores/import-store';
import { preferencesLocator } from '../../compass/packages/compass-preferences-model/src/provider';
import { createLoggerLocator } from '../../compass/packages/compass-logging/src/provider';
import { telemetryLocator } from '../../compass/packages/compass-telemetry/src/provider';
import { connectionsLocator } from '../../compass/packages/compass-connections/src/provider';
import { workspacesServiceLocator } from '../../compass/packages/compass-workspaces/src/provider';

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
