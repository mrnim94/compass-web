import React from 'react';
import ReactDOM from 'react-dom';
import { resetGlobalCSS, css, Body } from '@mongodb-js/compass-components';
import { CompassWeb } from '@haohanyang/compass-web';
import { sandboxLogger } from './sandbox-logger';
import { sandboxTelemetry } from './sandbox-telemetry';
import { sandboxConnectionStorage, SandboxConnectionStorageProviver } from './sandbox-connection-storage';
import { useWorkspaceTabRouter } from './sandbox-workspace-tab-router';

const sandboxContainerStyles = css({
  width: '100%',
  height: '100%',
});

resetGlobalCSS();

const App = () => {
  const [currentTab, updateCurrentTab] = useWorkspaceTabRouter();
  const atlasServiceSandboxBackendVariant = 'web-sandbox-atlas-local'

  const isAtlas = false;

  return (
    <SandboxConnectionStorageProviver
      value={isAtlas ? null : sandboxConnectionStorage}
      extraConnectionOptions={
        isAtlas
          ? // In the sandbox we're waiting for cert user to be propagated to
          // the clusters, it can take awhile on the first connection
          { connectTimeoutMS: 120_000, serverSelectionTimeoutMS: 120_000 }
          : {}
      }
    >
      <Body as="div" className={sandboxContainerStyles}>
        <CompassWeb
          orgId={''}
          projectId={''}
          onActiveWorkspaceTabChange={updateCurrentTab}
          initialWorkspace={currentTab ?? undefined}
          initialPreferences={{
            enablePerformanceAdvisorBanner: isAtlas,
            enableAtlasSearchIndexes: !isAtlas,
            maximumNumberOfActiveConnections: isAtlas ? 10 : undefined,
            atlasServiceBackendPreset: atlasServiceSandboxBackendVariant,
            enableCreatingNewConnections: !isAtlas,
            enableGlobalWrites: isAtlas,
            enableRollingIndexes: isAtlas,
          }}
          onTrack={sandboxTelemetry.track}
          onDebug={sandboxLogger.log}
          onLog={sandboxLogger.log}
        ></CompassWeb>
      </Body>
    </SandboxConnectionStorageProviver>
  );
};


ReactDOM.render(<App></App>, document.querySelector('#sandbox-app'));



