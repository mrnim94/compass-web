export const Telemetry = {
  track: (event: string, properties: any) => {
    if (process.env.NODE_ENV === "development") {
      console.log(event, properties);
    }
  },
};
