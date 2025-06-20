export const compassWebLogger = {
    log: (level: string, component: string, ...args: any[]) => {
        switch (level) {
            case "debug":
                if (process.env.ENABLE_DEBUG)
                    console.debug(component, args);
                break;
            case "info":
                if (process.env.ENABLE_INFO)
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
        if (process.env.ENABLE_DEBUG)
            console.debug(args)
    }
};
