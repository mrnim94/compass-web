import React from 'react';
import ReactDOM from 'react-dom';
import { resetGlobalCSS, css, Body } from '@mongodb-js/compass-components';
import { CompassWeb } from '@haohanyang/compass-web';
import { Logger } from './logger';
import { Telemetry } from './telemetry';
import {
  AppConnectionStorage,
  ApponnectionStorageProvider,
} from './connection-storage';
import { useWorkspaceTabRouter } from './workspace-tab-router';

const sandboxContainerStyles = css({
  width: '100%',
  height: '100%',
});

resetGlobalCSS();

const App = () => {
  const [currentTab, updateCurrentTab] = useWorkspaceTabRouter();
  const sandboxConnectionStorage = new AppConnectionStorage();

  return (
    <ApponnectionStorageProvider value={sandboxConnectionStorage}>
      {/* @ts-ignore */}
      <Body as="div" className={sandboxContainerStyles}>
        <CompassWeb
          orgId={''}
          projectId={''}
          onActiveWorkspaceTabChange={updateCurrentTab}
          initialWorkspace={currentTab ?? undefined}
          initialPreferences={{
            enablePerformanceAdvisorBanner: false,
            enableAtlasSearchIndexes: false,
            maximumNumberOfActiveConnections: undefined,
            atlasServiceBackendPreset: 'web-sandbox-atlas',
            enableCreatingNewConnections: true,
            enableGlobalWrites: false,
            enableRollingIndexes: false,
          }}
          onTrack={Telemetry.track}
          onDebug={Logger.log}
          onLog={Logger.log}
        ></CompassWeb>
      </Body>
    </ApponnectionStorageProvider>
  );
};

// @ts-ignore
ReactDOM.render(<App></App>, document.querySelector('#sandbox-app'));
