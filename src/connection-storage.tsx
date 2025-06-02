import type {
  ConnectionInfo,
  ConnectionStorage,
} from "@mongodb-js/connection-storage/provider";

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
