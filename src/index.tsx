import React from "react";
import ReactDOM from "react-dom";
import { CompassWeb } from "@mongodb-js/compass-web";
import { resetGlobalCSS, css, Body } from "@mongodb-js/compass-components";
import {
  SandboxConnectionStorage,
  SandboxConnectionStorageProvider,
} from "./connection-storage";

const sandboxContainerStyles = css({
  width: "100%",
  height: "100%",
});

resetGlobalCSS();

const App = () => {
  const connectionStorage = new SandboxConnectionStorage();
  return (
    <SandboxConnectionStorageProvider value={connectionStorage}>
      <Body as="div" className={sandboxContainerStyles}>
        <CompassWeb
          projectId="projectid"
          orgId="orgid"
          initialPreferences={{
            enableCreatingNewConnections: true,
            enableImportExport: true,
          }}
          onActiveWorkspaceTabChange={() => {
            console.log("onActiveWorkspaceTabChange");
          }}
          onFailToLoadConnections={() => {
            console.error("Failed to load connections");
          }}
        ></CompassWeb>
      </Body>
    </SandboxConnectionStorageProvider>
  );
};

ReactDOM.render(<App />, document.querySelector("#sandbox-app")!);
