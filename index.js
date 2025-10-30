#!/usr/bin/env node

import { main } from "./build/main.js";

main()
    .then((ret) => process.exit(ret))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
