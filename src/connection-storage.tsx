import type {
  ConnectionInfo,
  ConnectionStorage,
} from '@mongodb-js/connection-storage/provider';
import { openToast } from '@mongodb-js/compass-components';
import { SandboxConnectionStorageProvider } from '@haohanyang/compass-web';

export const ApponnectionStorageProvider = SandboxConnectionStorageProvider;

export class AppConnectionStorage implements ConnectionStorage {
  async loadAll(): Promise<ConnectionInfo[]> {
    try {
      const response = await fetch('/connections');

      if (!response.ok) {
        openToast('connection-storage', {
          title: 'Failed to load connections',
          description: (await response.json())['message'] || '',
        });
        return [];
      } else {
        const connections = await (response.json() as Promise<
          ConnectionInfo[]
        >);
        return connections;
      }
    } catch (error) {
      openToast('connection-storage', {
        title: 'Failed to load connections',
        description: (error as any).message || '',
      });
      return [];
    }
  }

  async load({ id }: { id: string }): Promise<ConnectionInfo | undefined> {
    return (await this.loadAll()).find((info) => {
      return info.id === id;
    });
  }

  async save({ connectionInfo }: { connectionInfo: ConnectionInfo }) {
    try {
      const response = await fetch('/connections', {
        method: 'POST',
        body: JSON.stringify(connectionInfo),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        openToast('connection-storage', {
          title: 'Failed to save connection',
          description: (await response.json())['message'] || '',
        });
      }
    } catch (error) {
      openToast('connection-storage', {
        title: 'Failed to save connection',
        description: (error as any).message || '',
      });
    }
  }

  async delete(options: { id: string }) {
    try {
      const response = await fetch(`/connections/${options.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        openToast('connection-storage', {
          title: 'Failed to delete connections',
          // @ts-ignore
          description: (await response.json()['message']) || '',
        });
      }
    } catch (error) {
      openToast('connection-storage', {
        title: 'Failed to delete connections',
        description: (error as any).message || '',
      });
    }
  }
}
