import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

const verifyJWT = asyncHandler( async (req, res, next) => {
    try {
        //: get accessToken from cookies or Autorization header 
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        if (!token) {
            throw new ApiError(401, "Unauthorized request.");
        }

        //: verify token & get required data from token
        const decodeToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        //: check user is valid for Logout 
        const user = await User.findById(decodeToken?._id).select("-password -refreshToken");
        if (!user) {
            // TODO: Discuss about frontend
            throw new ApiError(401, "Unauthorized request.");
        }

        //: add user to "req" object
        req.user = user;
        next();

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token.")
    }
});

export { verifyJWT };