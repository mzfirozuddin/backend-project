import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        //: save refreshToken in DB 
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return {
            accessToken,
            refreshToken
        }
    } catch (error) {
        // console.log("Error in generateAccessAndRefreshToken :: ", error);
        throw new ApiError(500, "Something went wrong while generating refresh and access token.")
    }

}

const registerUser = asyncHandler( async (req, res) => {
    //: get user details from frontend
    const { username, email, fullName, password } = req.body;
    // console.log(req.body);

    //: validation:- not empty
    // if (username === "") {
    //     throw new ApiError(400, "username is required")
    // }
    //- validate each field one by one (above way) OR validate all fields together (below way)
    if (
        [username, email, fullName, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }

    //: check if user already exists:- username, email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "user with username or email already exists")
    }

    //: collect images, check for avatar
    // console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;  //! faceing some issue
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }


    //: upload them to cloudinary, check avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    // console.log(avatar);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    // console.log(coverImage);
    if (!avatar) {
        throw new ApiError(400, "avatar file is required");
    }

    //: create user object:- create entry in DB 
    const user = await User.create({
        username: username.toLowerCase(),
        email,
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        password
    });

    //: remove password and refreshToken field from response
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    //: check for user creation
    if (!createdUser) {
        throw new ApiError(500, "Something went wromg while registering the user");
    }

    //: return response
    return res.status(201).json(new ApiResponse(201, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler( async(req, res) => {
    //: get user details from req.body
    // user can send username or email and password
    const { username, email, password } = req.body;
    // console.log(req.body);

    //: validation:- not empty
    if (!(username || email)) {
        throw new ApiError(400, "username or email is required");
    } 
    if (!password) {
        throw new ApiError(400, "username or email and password is required");
    }

    //: check user present or not in DB -> username or email
    const user = await User.findOne({
        $or:[{username}, {email}]
    }) 

    if (!user) {
        throw new ApiError(404, "user does not exist.")
    }

    //: If user present -> check password is correct or not 
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    //: generate accessToken and refreshToken 
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    
    //: send accessToken and refreshToken in cookies & return response
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }
    
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged in successfully."
            )
        )
})

const logoutUser = asyncHandler( async (req, res) => {
    //: remove refreshToken from DB
    const newData = await User.findByIdAndUpdate(
        req.user._id,
        {
            // $set: {     //? $set not working for this case
            //     refreshToken: undefined
            // }

            //? That's why we use "$unset" for remove "refreshToken" field from DB 
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    );

    // console.log(newData);

    //: remove accessToken and refreshToken from cookies & return response
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User logged out successfully.")
        )

});

const newAccessAndRefreshToken = asyncHandler( async (req, res) => {
    //: collect refreshToken from cookies or Autorization header or req.body
    const refresh_token = req.cookies?.refreshToken || req.header("Authorization")?.replace("Bearer ", "") || req.body.refreshToken;
    if (!refresh_token) {
        throw new ApiError(401, "Unauthorize request!");
    }

    try {
        //: verify refreshToken
        const decodedToken = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id);
        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token");
        }
    
        //: match collected refreshToken with DB_stored refreshToken
        if (refresh_token !== user.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }
    
        //: If everithing ok, then generate new accessToken and refreshToken & store in DB.
        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
    
        //: store new accessToken and refreshToken in cookies & send response
        const options = {
            httpOnly: true,
            secure: true
        } 
    
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken},
                    "Access token refreshed"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token");
    }

});

const changeCurrentPassword = asyncHandler( async (req, res) => {
    //: get old_password and new_password from req.body
    const { oldPassword, newPassword } = req.body;

    //: validation:- not empty
    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "old password and new password both are required");
    } 

    //: get userId from req.user(auth middleware) and find user from DB
    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(401, "Unauthorized access");
    }

    //: match old_password with DB_stored_password
    const isPasswordValid = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordValid) {
        throw new ApiError(400, "Invalid old password");
    }

    //: If matched -> set new_password in "user" object and save it to DB
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    //: return response
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully."));

});

const getCurrentUser = asyncHandler( async (req, res) => {
    //: get current user data from "req.user" (auth middleware) and return response
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user fetched successfully."));

});

const updateAccountDetails = asyncHandler( async (req, res) => {
    //: get account details that user want to update from req.body
    const { fullName, email } = req.body;
    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required");
    } 

    //: find user using "id" and update details
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken");

    //: return response
    return res
        .status(200)
        .json( new ApiResponse(200, user, "Account details updated successfully."));

});


export { 
    registerUser, 
    loginUser, 
    logoutUser,
    newAccessAndRefreshToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails
};