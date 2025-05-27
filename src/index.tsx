import React, { useEffect, useState } from 'react';
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
  const [defaultConnectionString, setDefaultConnectionString] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch('/default-connection')
      .then((res) => res.json())
      .then((data) => {
        if (data.uri) {
          setDefaultConnectionString(data.uri);
        }
      });
  }, []);

  // Inject default connection if none exist
  useEffect(() => {
    if (!defaultConnectionString) return;
    sandboxConnectionStorage.loadAll().then((connections) => {
      if (connections.length === 0) {
        // Add a default connection
        sandboxConnectionStorage.save({
          connectionInfo: {
            id: 'default-env-connection',
            connectionOptions: {
              connectionString: defaultConnectionString,
            },
            favorite: { name: 'Default from ENV' },
            lastUsed: new Date().toISOString(),
          },
        });
      }
    });
  }, [defaultConnectionString]);

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
          // Pass the default connection string if available
          defaultConnectionString={defaultConnectionString}
        ></CompassWeb>
      </Body>
    </ApponnectionStorageProvider>
  );
};

// @ts-ignore
ReactDOM.render(<App></App>, document.querySelector('#sandbox-app'));
