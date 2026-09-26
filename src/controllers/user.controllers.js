import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Jwt from "jsonwebtoken";
import mongoose from "mongoose";

//generating access and refresh token

const generateAccessAndRefreshTokens = async (userId) => {


    try {
        const user = await User.findById(userId)

        if (!user) {
            throw new ApiError(404, "User not found")
        }

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }



    } catch (error) {
        console.log("TOKEN GENERATION ERROR:", error);
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const registerUser = asyncHandler(async (req, res) => {

    console.log("REGISTER USER");

    // Get user details
    const { fullName, email, userName, password } = req.body;

    console.log("CONTROLLER VERSION 2");
    console.log("fullName:", fullName);
    console.log("email:", email);
    console.log("userName:", userName);
    console.log("password:", password);

    console.log("REQ.BODY:", req.body);
    console.log("REQ.FILES:", req.files);

    // Validation
    if (
        [fullName, email, userName, password]
            .some((field) => !field?.trim())
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // Check existing user
    const existedUser = await User.findOne({
        $or: [{ userName }, { email }]
    });

    if (existedUser) {
        throw new ApiError(
            409,
            "User with email or username already exists"
        );
    }

    // Get uploaded files
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    // Avatar is required
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // Upload avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    // Upload cover image only if provided
    const coverImage = coverImageLocalPath
        ? await uploadOnCloudinary(coverImageLocalPath)
        : null;

    if (!avatar) {
        throw new ApiError(
            400,
            "Avatar upload to Cloudinary failed"
        );
    }

    // Create user
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        userName: userName.toLowerCase()
    });

    // Get created user without sensitive fields
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(
            500,
            "Something went wrong while registering the user"
        );
    }

    return res.status(201).json(
        new ApiResponse(
            201,
            createdUser,
            "User registered successfully"
        )
    );
});

const loginUser = asyncHandler(async (req, res) => {
    //req body -> data
    //usename or email
    // find the user
    //password check
    //access and refresh token generate
    //send cookies
    //successfull response
    console.log("LOGIN BODY:", req.body);


    const { email, userName, password } = req.body

    if (!(userName || email)) {
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{ userName }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }
    console.log("USER ID:", user._id);

    const { accessToken, refreshToken } = await
        generateAccessAndRefreshTokens(user._id)


    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken")

    //sending cookies

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json( // if user wants to save these fields
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User Logged In Successfully"
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: false // mark for true during deployment
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User logged Out")
        )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = Jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "invalid refresh token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Referesh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: false
        }
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed"
                )
            )

    } catch (error) {
        throw new ApiError(401, error?.message ||
            "invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body

    const user = User.findById(req.user?._id)

    const isPasswordCorrect = user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old Password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res
        .save(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(200, req.user, "current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body

    if (!(fullName || email)) {
        throw new ApiError(400, "All fields are required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email,

            }
        },
        { new: true }

    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updatedb successfull"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.files?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,

        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Avatar is uploaded successfully")
        )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const covaerImageLocalPath = req.files?.path

    if (!covaerImageLocalPath) {
        throw new ApiError(400, "Cover file is missing")
    }

    const coverImage = await uploadOnCloudinary(covaerImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,

        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")
    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "cover image uploaded successfully")
        )
})


const getUserChannelProfile = asyncHandler(async (req, res) => {
   const {userName} = req.params

   if (!userName?.trim()) {
       throw new ApiError(400, "username is missing")
   }

   const channel = await User.aggregate([
    {
        $match: {
            userName : userName?.toLowerCase()
        }
    },
    {
        $lookup:{
            from : "subscription",
            localField : "_id",
            foreignField: "channel",
            as: "subscribers"
        }
    },
    {
        $lookup: {
            from : "subscription",
            localField : "_id",
            foreignField: "subscribers",
            as: "subscribedTo"
        }
    },
    {
        $addFields:{
            subscribersCount:{
                $size : "$subscribers"
            },
            channelsSubscribedToCount: {
                    $size : "$subscribedTo"
            },
            isSubscribed : {
                $cond : {
                    if:{$in : [req.user?._id, "$subscribers.subscriber"]},
                    then:true,
                    else: false
                }
            }
            
        }
    },
    {
        $project: {
            fullName: 1,
            userName:1,
            subscribersCount:1,
            channelsSubscribedToCount: 1,
            isSubscribed:1,
            avatar : 1,
            coverImage:1,
            email: 1,
        }
    }
   ])

   if(!channel?.length){
    throw new ApiError(404, "channel does not exists")
   }

   return res
   .status(200)
   .json(
    new ApiResponse(200, channel[0], "user channel fetched successfully")
   )

})


const getWatchHistory = asyncHandler(async (req, res) => {
      const user = await User.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(req.user?._id)
            }
            
        },
        {
                $lookup : {
                    from : "videos",
                    localField : "watchHistory",
                    foreignField : "_id",
                    as : "watchHistory",
                    pipeline : [
                        {
                            $lookup : {
                                from : "users",
                                localField: "owner",
                                foreignField: "_id",
                                as:"owner",
                                pipeline : [
                                    {
                                        $project : {
                                            fullName : 1,
                                            userName:1,
                                            avatar:1
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields : {
                                owner : {
                                    $first: "$owner"
                                }
                            }
                        }
                    ]
                }
            }
      ])

      return res
      .status(200)
      .json(
        new ApiResponse(200, user[0].watchHistory, "watch history fetched successfully")
      )
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};