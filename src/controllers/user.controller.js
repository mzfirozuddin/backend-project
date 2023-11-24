import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async (req, res) => {
    //* get user details from frontend
    const { username, email, fullName, password } = req.body;
    // console.log(req.body);

    //* validation:- not empty
    // if (username === "") {
    //     throw new ApiError(400, "username is required")
    // }
    //: validate each field one by one (above way) OR validate all fields together (below way)
    if (
        [username, email, fullName, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }

    //* check if user already exists:- username, email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "user with username or email already exists")
    }

    //* collect images, check for avatar
    // console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar file is required");
    }

    //* upload them to cloudinary, check avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!avatar) {
        throw new ApiError(400, "avatar file is required");
    }

    //* create user object:- create entry in DB 
    const user = await User.create({
        username: username.toLowerCase(),
        email,
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        password
    });

    //* remove password and refreshToken field from response
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    //* check for user creation
    if (!createdUser) {
        throw new ApiError(500, "Something went wromg while registering the user");
    }

    //* return response
    return res.status(201).json(new ApiResponse(201, createdUser, "User registered successfully"));
});

export { registerUser };