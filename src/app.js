import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// routes import
import userRouter from "./routes/user.routes.js";

const app = express();
app.use((req, res, next) => {
    console.log("🔥 REQUEST RECEIVED 🔥");
    console.log("METHOD:", req.method);
    console.log("URL:", req.url);
    next();
});

console.log("APP.JS LOADED");

app.get("/test", (req, res) => {
    res.send("APP.JS IS WORKING");
});

app.get("/", (req, res) => {
    res.send("ROOT TEST");
});

app.use(express.static("public"));

app.use(cookieParser());

console.log("in app");

app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    })
);

app.use((req, res, next) => {
    console.log("🔥 REQUEST RECEIVED 🔥");
    console.log("METHOD:", req.method);
    console.log("URL:", req.url);
    next();
});

app.use(express.json({ limit: "16kb" }));

app.use(
    express.urlencoded({
        extended: true,
        limit: "16kb",
    })
);

// Routes
app.use("/api/v1/users", userRouter);

// Global error handler
app.use((err, req, res, next) => {
    console.error("Global Error:", err.message, err.stack);

    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});

export { app };