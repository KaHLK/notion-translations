#!/usr/bin/env node

const main = require("./build/main.js");

main.default()
    .then((ret) => process.exit(ret))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
