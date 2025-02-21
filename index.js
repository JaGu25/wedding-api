import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const dynamoDB = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = process.env.BUCKET_NAME;
const FILE_TABLE = process.env.FILE_TABLE;

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(express.json());

app.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se ha enviado un archivo" });
    }

    const fileKey = `${uuidv4()}-${req.file.originalname}`;
    const params = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: "public-read",
    });

    await s3.send(params);

    const item = {
      id: { S: fileKey },
      filename: { S: req.file.originalname },
      url: { S: `https://${BUCKET_NAME}.s3.amazonaws.com/${fileKey}` },
      createdAt: { S: new Date().toISOString() },
    };

    await dynamoDB.send(
      new PutItemCommand({
        TableName: FILE_TABLE,
        Item: item,
      })
    );

    return res.status(200).json({
      message: "Archivo subido con éxito",
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

app.use((err, req, res, next) => {
  console.error("Error general:", err);
  res
    .status(500)
    .json({ message: "Error interno del servidor", error: err.message });
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

export default app;
