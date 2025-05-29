import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {
  CompassWeb,
  SandboxPreferencesUpdateProvider,
  type SandboxPreferencesUpdateTrigger,
  useCompassWebPreferences,
  SandboxConnectionStorageProvider,
} from "@mongodb-js/compass-web";
import {
  resetGlobalCSS,
  css,
  Body,
  openToast,
} from "@mongodb-js/compass-components";
import { sandboxConnectionStorage } from "./connection-storage.tsx";

const sandboxContainerStyles = css({
  width: "100%",
  height: "100%",
});

resetGlobalCSS();

const App = () => {
  const pref = useCompassWebPreferences();
  const sandboxPreferencesUpdateTrigger =
    useRef<null | SandboxPreferencesUpdateTrigger>(null);

  sandboxPreferencesUpdateTrigger.current = (updatePreference) => {
    return () => updatePreference({});
  };

  return (
    <SandboxConnectionStorageProvider value={sandboxConnectionStorage}>
      <SandboxPreferencesUpdateProvider
        value={sandboxPreferencesUpdateTrigger.current}
      >
        <Body as="div" className={sandboxContainerStyles}>
          <CompassWeb
            projectId="projectid"
            orgId="orgid"
            onActiveWorkspaceTabChange={() => {}}
            onFailToLoadConnections={() => {}}
          ></CompassWeb>
        </Body>
      </SandboxPreferencesUpdateProvider>
    </SandboxConnectionStorageProvider>
  );
};

ReactDOM.render(<App></App>, document.querySelector("#sandbox-app")!);
