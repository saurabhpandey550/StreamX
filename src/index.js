import connectDB from "./db/index.js";
import { app } from "./app.js";

console.log("INDEX.JS LOADED");

app.get("/direct-test", (req, res) => {
    console.log("DIRECT TEST HIT");
    res.send("INDEX.JS DIRECT TEST WORKS");
});

connectDB()
    .then(() => {
        app.listen(process.env.PORT || 8000, () => {
            console.log(
                `server is running at port : ${process.env.PORT || 8000}`
            );
        });
    })
    .catch((error) => {
        console.log("MONGO db connection failed !!!", error);
    });