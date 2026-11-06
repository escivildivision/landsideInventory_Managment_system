const serverless = require("serverless-http");
const app = require("../../Server");

const wrappedHandler = serverless(app, {
    binary: ["application/pdf", "application/octet-stream", "image/*"]
});

module.exports.handler = async (event, context) => {
    // Fix 1: Decode base64-encoded bodies (Netlify encodes binary content)
    if (event.body && event.isBase64Encoded) {
        event.body = Buffer.from(event.body, "base64").toString("utf8");
        event.isBase64Encoded = false;
    }

    // Fix 2: Ensure Content-Type header is set for POST/PUT so express.json() parses the body.
    // Netlify CDN sometimes strips this header when rewriting requests to functions.
    if (event.body && (event.httpMethod === "POST" || event.httpMethod === "PUT")) {
        event.headers = event.headers || {};
        const ct = event.headers["content-type"] || event.headers["Content-Type"] || "";
        if (!ct.includes("application/json")) {
            event.headers["content-type"] = "application/json";
        }
    }

    return wrappedHandler(event, context);
};

