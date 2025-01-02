const logging: { name: string; component: string; args: any[] }[] = ((
  globalThis as any
).logging = []);


export const sandboxLogger = {
  log: (name: string, component: string, ...args: any[]) => {
    logging.push({ name, component, args });
  },
};
