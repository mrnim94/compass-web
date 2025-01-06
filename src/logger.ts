export const Logger = {
  log: (name: string, component: string, ...args: any[]) => {
    console.log(name, component, args);
  },

  debug: (name: string, component: string, ...args: any[]) => {
    if (process.env.NODE_ENV === "development") {
      console.log(name, component, args);
    }
  },
};
