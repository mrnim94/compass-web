import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {
  CompassWeb,
  // SandboxPreferencesUpdateProvider,
  // type SandboxPreferencesUpdateTrigger,
  // useCompassWebPreferences,
} from "@mongodb-js/compass-web";
import {
  resetGlobalCSS,
  css,
  Body,
  openToast,
} from "@mongodb-js/compass-components";

const sandboxContainerStyles = css({
  width: "100%",
  height: "100%",
});

resetGlobalCSS();

const App = () => {
  // const pref = useCompassWebPreferences();
  // const sandboxPreferencesUpdateTrigger =
  //   useRef<null | SandboxPreferencesUpdateTrigger>(null);

  // sandboxPreferencesUpdateTrigger.current = (updatePreference) => {
  //   return () => updatePreference({});
  // };

  return (
    <Body as="div" className={sandboxContainerStyles}>
      <CompassWeb
        projectId="projectid"
        orgId="orgid"
        onActiveWorkspaceTabChange={() => {}}
        onFailToLoadConnections={() => {}}
      ></CompassWeb>
    </Body>
  );
};

ReactDOM.render(<App></App>, document.querySelector("#sandbox-app")!);
