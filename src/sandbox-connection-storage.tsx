import React from 'react';
import type {
  ConnectionInfo,
  ConnectionStorage,
} from '@mongodb-js/connection-storage/provider';


const SandboxConnectionStorageContext =
  React.createContext<ConnectionStorage | null>(null);

const SandboxExtraConnectionOptionsContext = React.createContext<
  Record<string, any> | undefined
>(undefined);


export const SandboxConnectionStorageProviver = ({
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


const historyKey = 'CONNECTIONS_HISTORY_V$';

function getHistory(): ConnectionInfo[] {
  try {
    const b64Str = localStorage.getItem(historyKey);
    if (!b64Str) {
      return [];
    }
    const binStr = window.atob(b64Str);
    const bytes = Uint8Array.from(binStr, (v) => v.codePointAt(0) ?? 0);
    const str = new TextDecoder().decode(bytes);
    return JSON.parse(str);
  } catch (err) {
    return [];
  }
}
function saveHistory(history: ConnectionInfo[]) {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(history));
    const binStr = String.fromCodePoint(...bytes);
    const b64Str = window.btoa(binStr);
    localStorage.setItem(historyKey, b64Str);
  } catch (err) {
    // noop
  }
}

class SandboxConnectionStorage implements ConnectionStorage {
  private _connections = new Map(
    getHistory().map((info) => {
      return [info.id, info];
    })
  );
  loadAll(): Promise<ConnectionInfo[]> {
    return Promise.resolve(Array.from(this._connections.values()));
  }
  load({ id }: { id: string }): Promise<ConnectionInfo | undefined> {
    return Promise.resolve(this._connections.get(id));
  }
  save({ connectionInfo }: { connectionInfo: ConnectionInfo }): Promise<void> {
    this._connections.set(connectionInfo.id, connectionInfo);
    setTimeout(() => {
      saveHistory(Array.from(this._connections.values()));
    }, 0);
    return Promise.resolve();
  }
  delete({ id }: { id: string }): Promise<void> {
    this._connections.delete(id);
    setTimeout(() => {
      saveHistory(Array.from(this._connections.values()));
    }, 0);
    return Promise.resolve();
  }
}

export const sandboxConnectionStorage = new SandboxConnectionStorage();
