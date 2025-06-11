import React from 'react';
import ReactDOM from 'react-dom';
import { CompassWeb } from '@mongodb-js/compass-web';
import {
  resetGlobalCSS,
  css,
  Body,
  openToast,
} from '@mongodb-js/compass-components';
import { useWorkspaceTabRouter } from './workspace-tab-router';
import { type AllPreferences } from 'compass-preferences-model';

const sandboxContainerStyles = css({
  width: '100%',
  height: '100%',
});

const initialPreferences: Partial<AllPreferences> = {
  enableExportSchema: true,
  enablePerformanceAdvisorBanner: false,
  enableAtlasSearchIndexes: false,
  maximumNumberOfActiveConnections: undefined,
  enableCreatingNewConnections: true,
  enableGlobalWrites: false,
  enableRollingIndexes: false,
  showDisabledConnections: true,
  enableGenAIFeaturesAtlasProject: false,
  enableGenAISampleDocumentPassingOnAtlasProject: false,
  enableGenAIFeaturesAtlasOrg: false,
  optInDataExplorerGenAIFeatures: false,
  enableDataModeling: false,
};

resetGlobalCSS();

const App = () => {
  const [currentTab, updateCurrentTab] = useWorkspaceTabRouter();

  return (
    <Body as="div" className={sandboxContainerStyles}>
      <CompassWeb
        projectId="projectid"
        orgId="orgid"
        onActiveWorkspaceTabChange={updateCurrentTab}
        initialWorkspace={currentTab ?? undefined}
        initialPreferences={initialPreferences}
        onFailToLoadConnections={(error) => {
          openToast('failed-to-load-connections', {
            title: 'Failed to load connections',
            description: error.message,
            variant: 'warning',
          });
        }}
      ></CompassWeb>
    </Body>
  );
};

ReactDOM.render(<App />, document.querySelector('#sandbox-app')!);
