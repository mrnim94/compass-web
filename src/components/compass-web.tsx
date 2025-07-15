import React, { useEffect, useRef, useState } from 'react';
import AppRegistry, {
  AppRegistryProvider,
  GlobalAppRegistryProvider,
} from '../../compass/packages/hadron-app-registry/src';
import type { ConnectionInfo } from '../../compass/packages/compass-connections/provider';
import { useConnectionActions } from '../../compass/packages/compass-connections/provider';
import { CompassInstanceStorePlugin } from '../../compass/packages/compass-app-stores';
import type { OpenWorkspaceOptions } from '../../compass/packages/compass-workspaces';
import WorkspacesPlugin, {
  WorkspacesProvider,
} from '../../compass/packages/compass-workspaces';
import { CompassSettingsPlugin } from '../../compass/packages/compass-settings';
import {
  DatabasesWorkspaceTab,
  CollectionsWorkspaceTab,
} from '../../compass/packages/databases-collections';
import {
  CompassComponentsProvider,
  css,
} from '../../compass/packages/compass-components';
import {
  WorkspaceTab as CollectionWorkspace,
  CollectionTabsProvider,
} from '../../compass/packages/compass-collection';
import {
  CompassSidebarPlugin,
  AtlasClusterConnectionsOnlyProvider,
} from '../../compass/packages/compass-sidebar';
import CompassQueryBarPlugin from '../../compass/packages/compass-query-bar';
import { CompassDocumentsPlugin } from '../../compass/packages/compass-crud';
import {
  CompassAggregationsPlugin,
  CreateViewPlugin,
} from '../../compass/packages/compass-aggregations';
import { CompassSchemaPlugin } from '../../compass/packages/compass-schema';
import { CompassIndexesPlugin } from '../../compass/packages/compass-indexes';
import { CompassSchemaValidationPlugin } from '../../compass/packages/compass-schema-validation';
import { CompassGlobalWritesPlugin } from '../../compass/packages/compass-global-writes';
import { CompassGenerativeAIPlugin } from '../../compass/packages/compass-generative-ai';
import ExplainPlanCollectionTabModal from '../../compass/packages/compass-explain-plan';
import ExportToLanguageCollectionTabModal from '../../compass/packages/compass-export-to-language';
import { ExportPlugin } from './export-plugin';
import { ImportPlugin } from './import-plugin';
import {
  CreateNamespacePlugin,
  DropNamespacePlugin,
  RenameCollectionPlugin,
} from '../../compass/packages/databases-collections';
import { PreferencesProvider } from '../../compass/packages/compass-preferences-model/src/provider';
import type { AllPreferences } from '../../compass/packages/compass-preferences-model/src/provider';
import FieldStorePlugin from '../../compass/packages/compass-field-store';
import { AtlasServiceProvider } from '../../compass/packages/atlas-service/src/provider';
import { AtlasAiServiceProvider } from '../../compass/packages/compass-generative-ai/src/provider';
import { LoggerProvider } from '../../compass/packages/compass-logging/src/provider';
import { TelemetryProvider } from '../../compass/packages/compass-telemetry/src/provider';
import CompassConnections from '../../compass/packages/compass-connections';
import { AtlasCloudConnectionStorageProvider } from '../../compass/packages/compass-web/src/connection-storage';
import { AtlasCloudAuthServiceProvider } from '../../compass/packages/compass-web/src/atlas-auth-service';
import type {
  TrackFunction,
  LogFunction,
  DebugFunction,
} from '../../compass/packages/compass-web/src/logger-and-telemetry';
import { useCompassWebLoggerAndTelemetry } from '../../compass/packages/compass-web/src/logger-and-telemetry';
import { type TelemetryServiceOptions } from '../../compass/packages/compass-telemetry';
import { WebWorkspaceTab as WelcomeWorkspaceTab } from '../../compass/packages/compass-welcome';
import { useCompassWebPreferences } from './preferences';
import { WorkspaceTab as DataModelingWorkspace } from '../../compass/packages/compass-data-modeling';
import { DataModelStorageServiceProviderInMemory } from '../../compass/packages/compass-data-modeling/web';

const WithAtlasProviders: React.FC = ({ children }) => {
  return (
    <AtlasCloudAuthServiceProvider>
      <AtlasClusterConnectionsOnlyProvider value={true}>
        <AtlasServiceProvider>
          <AtlasAiServiceProvider apiURLPreset="cloud">
            {children}
          </AtlasAiServiceProvider>
        </AtlasServiceProvider>
      </AtlasClusterConnectionsOnlyProvider>
    </AtlasCloudAuthServiceProvider>
  );
};

type CompassWorkspaceProps = Pick<
  React.ComponentProps<typeof WorkspacesPlugin>,
  'initialWorkspaceTabs' | 'onActiveWorkspaceTabChange'
> &
  Pick<
    React.ComponentProps<typeof CompassSidebarPlugin>,
    'onOpenConnectViaModal'
  >;

type CompassWebProps = {
  appName?: string;
  orgId: string;
  projectId: string;
  initialAutoconnectId?: string;
  initialWorkspace?: OpenWorkspaceOptions;
  onActiveWorkspaceTabChange: React.ComponentProps<
    typeof WorkspacesPlugin
  >['onActiveWorkspaceTabChange'];
  initialPreferences?: Partial<AllPreferences>;
  onLog?: LogFunction;
  onDebug?: DebugFunction;
  onTrack?: TrackFunction;
  onOpenConnectViaModal?: (
    atlasMetadata: ConnectionInfo['atlasMetadata']
  ) => void;
  onFailToLoadConnections: (err: Error) => void;
};

function CompassWorkspace({
  initialWorkspaceTabs,
  onActiveWorkspaceTabChange,
  onOpenConnectViaModal,
}: CompassWorkspaceProps) {
  return (
    <WorkspacesProvider
      value={[
        WelcomeWorkspaceTab,
        DatabasesWorkspaceTab,
        CollectionsWorkspaceTab,
        CollectionWorkspace,
        DataModelingWorkspace,
      ]}
    >
      <CollectionTabsProvider
        queryBar={CompassQueryBarPlugin}
        tabs={[
          CompassDocumentsPlugin,
          CompassAggregationsPlugin,
          CompassSchemaPlugin,
          CompassIndexesPlugin,
          CompassSchemaValidationPlugin,
          CompassGlobalWritesPlugin,
        ]}
        modals={[
          ExplainPlanCollectionTabModal,
          ExportToLanguageCollectionTabModal,
        ]}
      >
        <div
          data-testid="compass-web-connected"
          className={connectedContainerStyles}
        >
          <WorkspacesPlugin
            initialWorkspaceTabs={initialWorkspaceTabs}
            openOnEmptyWorkspace={{ type: 'Welcome' }}
            onActiveWorkspaceTabChange={onActiveWorkspaceTabChange}
            renderSidebar={() => {
              return (
                <CompassSidebarPlugin
                  onOpenConnectViaModal={onOpenConnectViaModal}
                  isCompassWeb={false}
                ></CompassSidebarPlugin>
              );
            }}
            renderModals={() => {
              return (
                <>
                  <CreateViewPlugin></CreateViewPlugin>
                  <CreateNamespacePlugin></CreateNamespacePlugin>
                  <DropNamespacePlugin></DropNamespacePlugin>
                  <RenameCollectionPlugin></RenameCollectionPlugin>
                  <ExportPlugin></ExportPlugin>
                  <ImportPlugin></ImportPlugin>
                </>
              );
            }}
          ></WorkspacesPlugin>
        </div>
      </CollectionTabsProvider>
    </WorkspacesProvider>
  );
}

const WithConnectionsStore: React.FunctionComponent<{
  children: React.ReactElement;
}> = ({ children }) => {
  const actions = useConnectionActions();
  useEffect(() => {
    const intervalId = setInterval(() => {
      void actions.refreshConnections();
    }, /* Matches default polling intervals in mms codebase */ 60_000);
    return () => {
      clearInterval(intervalId);
    };
  }, [actions]);
  return <>{children}</>;
};

const LINK_PROPS = {
  utmSource: 'DE',
  utmMedium: 'product',
} as const;

const connectedContainerStyles = css({
  width: '100%',
  height: '100%',
  display: 'flex',
});

const CompassWeb = ({
  appName,
  orgId,
  projectId,
  initialAutoconnectId,
  initialWorkspace,
  onActiveWorkspaceTabChange,
  initialPreferences,
  onLog,
  onDebug,
  onTrack,
  onOpenConnectViaModal,
  onFailToLoadConnections,
}: CompassWebProps) => {
  const appRegistry = useRef(new AppRegistry());
  const logger = useCompassWebLoggerAndTelemetry({
    onLog,
    onDebug,
  });
  const preferencesAccess = useCompassWebPreferences(initialPreferences);
  const initialWorkspaceRef = useRef(initialWorkspace);
  const initialWorkspaceTabsRef = useRef(
    initialWorkspaceRef.current ? [initialWorkspaceRef.current] : []
  );

  const autoconnectId =
    initialWorkspaceRef.current && 'connectionId' in initialWorkspaceRef.current
      ? initialWorkspaceRef.current.connectionId
      : initialAutoconnectId ?? undefined;

  const onTrackRef = useRef(onTrack);

  const telemetryOptions = useRef<TelemetryServiceOptions>({
    sendTrack: (event: string, properties: Record<string, any> | undefined) => {
      onTrackRef.current && void onTrackRef.current(event, properties || {});
    },
    logger,
    preferences: preferencesAccess.current,
  });

  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    preferencesAccess.current
      .getConfigurableUserPreferences()
      .then((preferences) => {
        const theme = preferences['theme'];
        if (theme == 'DARK') {
          setDarkMode(true);
        } else if (theme == 'LIGHT') {
          setDarkMode(false);
        } else {
          if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
            setDarkMode(true);
          } else {
            setDarkMode(false);
          }
        }
      });
  }, [preferencesAccess]);

  preferencesAccess.current.onPreferenceValueChanged('theme', (theme) => {
    if (theme == 'DARK') {
      setDarkMode(true);
    } else if (theme == 'LIGHT') {
      setDarkMode(false);
    }
  });

  return (
    <GlobalAppRegistryProvider value={appRegistry.current}>
      <AppRegistryProvider scopeName="Compass Web Root">
        <CompassComponentsProvider
          darkMode={darkMode}
          stackedElementsZIndex={10_000}
          onNextGuideGue={(cue) => {
            onTrackRef.current?.('Guide Cue Dismissed', {
              groupId: cue.groupId,
              cueId: cue.cueId,
              step: cue.step,
            });
          }}
          onNextGuideCueGroup={(cue) => {
            if (cue.groupSteps !== cue.step) {
              onTrackRef.current?.('Guide Cue Group Dismissed', {
                groupId: cue.groupId,
                cueId: cue.cueId,
                step: cue.step,
              });
            }
          }}
          onSignalMount={(id) => {
            onTrackRef.current?.('Signal Shown', { id });
          }}
          onSignalOpen={(id) => {
            onTrackRef.current?.('Signal Opened', { id });
          }}
          onSignalPrimaryActionClick={(id) => {
            onTrackRef.current?.('Signal Action Button Clicked', { id });
          }}
          onSignalLinkClick={(id) => {
            onTrackRef.current?.('Signal Link Clicked', { id });
          }}
          onSignalClose={(id) => {
            onTrackRef.current?.('Signal Closed', { id });
          }}
          {...LINK_PROPS}
        >
          <PreferencesProvider value={preferencesAccess.current}>
            <LoggerProvider value={logger}>
              <TelemetryProvider options={telemetryOptions.current}>
                <WithAtlasProviders>
                  <DataModelStorageServiceProviderInMemory>
                    <AtlasCloudConnectionStorageProvider
                      orgId={orgId}
                      projectId={projectId}
                    >
                      {/* <FileInputBackendProvider
                        createFileInputBackend={() => ({
                          openFileChooser: (options) => {
                            console.log('openFileChooser');
                          },
                          onFilesChosen: (listener) => {
                            console.log('onFilesChosen');
                            return () => {};
                          },
                          getPathForFile: (file) => {
                            return file.path;
                          },
                        })}
                      > */}
                      <CompassConnections
                        appName={appName ?? 'Compass Web'}
                        onFailToLoadConnections={onFailToLoadConnections}
                        onExtraConnectionDataRequest={() => {
                          return Promise.resolve([{}, null] as [
                            Record<string, unknown>,
                            null
                          ]);
                        }}
                        onAutoconnectInfoRequest={(connectionStore) => {
                          if (autoconnectId) {
                            return connectionStore.loadAll().then(
                              (connections) => {
                                return connections.find(
                                  (connectionInfo) =>
                                    connectionInfo.id === autoconnectId
                                );
                              },
                              (err) => {
                                const { log, mongoLogId } = logger;
                                log.warn(
                                  mongoLogId(1_001_000_329),
                                  'Compass Web',
                                  'Could not load connections when trying to autoconnect',
                                  { err: err.message }
                                );
                                return undefined;
                              }
                            );
                          }
                          return Promise.resolve(undefined);
                        }}
                      >
                        <CompassInstanceStorePlugin>
                          <FieldStorePlugin>
                            <WithConnectionsStore>
                              <CompassWorkspace
                                initialWorkspaceTabs={
                                  initialWorkspaceTabsRef.current
                                }
                                onActiveWorkspaceTabChange={
                                  onActiveWorkspaceTabChange
                                }
                                onOpenConnectViaModal={onOpenConnectViaModal}
                              ></CompassWorkspace>
                            </WithConnectionsStore>
                            <CompassSettingsPlugin></CompassSettingsPlugin>
                          </FieldStorePlugin>
                          <CompassGenerativeAIPlugin projectId={projectId} />
                        </CompassInstanceStorePlugin>
                      </CompassConnections>
                      {/* </FileInputBackendProvider> */}
                    </AtlasCloudConnectionStorageProvider>
                  </DataModelStorageServiceProviderInMemory>
                </WithAtlasProviders>
              </TelemetryProvider>
            </LoggerProvider>
          </PreferencesProvider>
        </CompassComponentsProvider>
      </AppRegistryProvider>
    </GlobalAppRegistryProvider>
  );
};

export { CompassWeb };
