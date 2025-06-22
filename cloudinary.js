// cloudinary.js
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: "dwj2kdvue",
  api_key: "3tV-CMOxhO2NwT15aPWexp2XpLc",
  api_secret: "3tV-CMOxhO2NwT15aPWexp2XpLc",
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

module.exports = { cloudinary, storage };
