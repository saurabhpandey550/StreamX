import { Router } from "express";
import { loginUser, logoutUser, registerUser, refreshAccessToken } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

// router.route("/register").post((req, res, next) => {
//     console.log("POST /register hit!");
//     console.log("BODY:", req.body);
//     console.log("FILES:", req.files);
//     next();
// }, upload.fields([
//     { name: "avatar", maxCount: 1 },
//     { name: "coverImage", maxCount: 1 }
// ]),
// (req, res, next) => {
//     console.log("req.files:", req.files); 
//     next();
//   }, registerUser)
//;

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount:1
        }, 
        {
            name:"coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser)

//secured routes

router.route("/logout").post(verifyJWT, logoutUser)

router.route("/refresh-token").post(refreshAccessToken)

export default router