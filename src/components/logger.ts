export const compassWebLogger = {
    log: (level: string, component: string, ...args: any[]) => {
        switch (level) {
            case "debug":
                console.debug(component, args);
                break;
            case "info":
                console.info(component, args);
                break;
            case "warn":
                console.warn(component, args);
                break;
            case "error":
                console.error(component, args);
                break;
            case "fatal":
                console.error(component, args);
                break;
            default:
                console.log(component, args);
        }
    },
    debug: (...args: any[]) => {
        console.debug(args)
    }
};
