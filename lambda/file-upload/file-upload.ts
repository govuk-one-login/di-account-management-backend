import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event: any): Promise<string> => {
  const bucketName: string = event.ResourceProperties.BucketName;
  const objectKey: string = event.ResourceProperties.ObjectKey;
  const contentType: string = event.ResourceProperties.ContentType;
  const fileContent: string = event.ResourceProperties.FileContent;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: contentType,
        Body: fileContent,
      })
    );

    return "Success";
  } catch (error) {
    throw error;
  }
};
