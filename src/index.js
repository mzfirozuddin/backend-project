import dotenv from "dotenv";
// dotenv.config();  //: this is also fine
dotenv.config({
    path: "./.env"
});

import connectDB from "./db/index.js";
import { app } from "./app.js";

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("MongoDB connection error !!!", err);
})




//- This is another way to connect database 
/* 
import mongoose from "mongoose";
import { DB_NAME } from "./constants";

import express from "express";
const app = express();


( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        app.on("error", (error) => {
            console.log("ERROR: ", error);
            throw error;
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
        })

    } catch (error) {
        console.error("ERROR: ", error);
        throw error;
    }
})() 
*/