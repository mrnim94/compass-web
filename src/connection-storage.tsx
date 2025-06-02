import React from "react";
import type {
  ConnectionInfo,
  ConnectionStorage,
} from "@mongodb-js/connection-storage/provider";

const SandboxConnectionStorageContext =
  React.createContext<ConnectionStorage | null>(null);

const SandboxExtraConnectionOptionsContext = React.createContext<
  Record<string, any> | undefined
>(undefined);

export const SandboxConnectionStorageProvider = ({
  value,
  extraConnectionOptions,
  children,
}: {
  value: ConnectionStorage | null;
  extraConnectionOptions?: Record<string, any>;
  children: React.ReactNode;
}) => {
  return (
    <SandboxConnectionStorageContext.Provider value={value}>
      <SandboxExtraConnectionOptionsContext.Provider
        value={extraConnectionOptions}
      >
        {children}
      </SandboxExtraConnectionOptionsContext.Provider>
    </SandboxConnectionStorageContext.Provider>
  );
};

export class SandboxConnectionStorage implements ConnectionStorage {
  loadAll(): Promise<ConnectionInfo[]> {
    console.log("Load all");
    return Promise.resolve([]);
  }

  load({ id }: { id: string }): Promise<ConnectionInfo | undefined> {
    console.log("Load " + id);
    return Promise.resolve(undefined);
  }
  save({ connectionInfo }: { connectionInfo: ConnectionInfo }): Promise<void> {
    console.log("Save info");
    return Promise.resolve();
  }
  delete({ id }: { id: string }): Promise<void> {
    console.log("delete ", id);
    return Promise.resolve();
  }
}
