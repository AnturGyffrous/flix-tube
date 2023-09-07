const express = require("express");

if (!process.env.PORT) {
    throw new Error("Please specify the port number for the HTTP server with the environment variable PORT.");
}

const PORT = process.env.PORT;

//
// Application entry point.
//
async function main() {

    console.log("Starting history microservice...");

    const app = express();

    // ... add route handlers here ...

    app.listen(PORT, () => {
        console.log("history microservice online.");
    });
}

main()
    .catch(err => {
        console.error("history microservice failed to start.");
        console.error(err && err.stack || err);
    });