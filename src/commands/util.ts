import { GenCache } from "../cache";
import { Config } from "../config";

interface InitOptions {
    outDir?: string;
}
export function init(options: InitOptions, config: Config) {
    if (options.outDir) {
        config.out = options.outDir;
    }
}

interface CleanOptions {
    all: boolean;
    cache: boolean;
}
export async function clean(options: CleanOptions) {
    if (options.all) {
        await Config.rm();
    }

    if (options.cache) {
        await GenCache.delete();
    }
    process.exit(0);
}
