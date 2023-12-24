import dotenv from "dotenv";
dotenv.config();

import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        // upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        
        // file has been uploaded successfully
        // console.log("File is uploaded on cloudinary successfully", response.url);
        fs.unlinkSync(localFilePath);   //: remove files from local server

        // console.log(response);
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath)  // remove the locally saved temporary file as the upload operation got failed.
        console.log("Error on uploadOnCloudinary :: ", error);
        return null;
    }
}

const deleteFromCloudinary = async(cloudinaryFileName) => {
    try {
        if (!cloudinaryFileName) {
            return null;
        }

        const response = await cloudinary.uploader.destroy(cloudinaryFileName, {
            resource_type: "image",
            invalidate: true
        });

        // console.log(response);
        return response;

    } catch (error) {
        console.log("Error on deleteFromCloudinary :: ", error);
        return null;
    }
}

export { uploadOnCloudinary, deleteFromCloudinary };



// cloudinary.v2.api
//   .delete_resources(['xw6rzwdjztbi7a6qicnx'], 
//     { type: 'upload', resource_type: 'image' })
//   .then(console.log);