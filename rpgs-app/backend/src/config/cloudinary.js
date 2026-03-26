const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Ajustado para bater EXATAMENTE com o seu .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,       
    api_secret: process.env.CLOUDINARY_SECRET  
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'decadencia_cinza_uploads',
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
    },
});

const upload = multer({ storage: storage });

module.exports = upload;