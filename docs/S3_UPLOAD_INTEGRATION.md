# S3 Image Upload Integration

## API Endpoint

**POST** `/api/v1/upload/image`

- **Content-Type:** `multipart/form-data`
- **Field name:** `image`
- **Max size:** 5MB
- **Allowed types:** jpeg, jpg, png, webp, gif

## Response

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Image uploaded successfully",
  "data": {
    "url": "https://your-bucket.s3.ap-south-1.amazonaws.com/uploads/uuid.jpg"
  }
}
```

## Frontend Usage

### Fetch
```javascript
const formData = new FormData();
formData.append("image", file); // file from input[type=file]

const res = await fetch("http://your-api/api/v1/upload/image", {
  method: "POST",
  body: formData,
});
const json = await res.json();
const imageUrl = json.data.url; // use this in service create/update
```

### Axios
```javascript
const formData = new FormData();
formData.append("image", file);

const { data } = await axios.post("/api/v1/upload/image", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
const imageUrl = data.data.url;
```

### React Example
```jsx
const [imageUrl, setImageUrl] = useState("");

const handleUpload = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch("/api/v1/upload/image", {
    method: "POST",
    body: formData,
  });
  const json = await res.json();
  if (json.success) {
    setImageUrl(json.data.url);
  }
};

return (
  <>
    <input type="file" accept="image/*" onChange={handleUpload} />
    {imageUrl && <img src={imageUrl} alt="Uploaded" />}
  </>
);
```

## Environment Variables

Add to `.env`:
```
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket-name
```

## S3 Bucket Setup

1. Create bucket in AWS S3
2. Disable "Block all public access" if you need public URLs
3. Add bucket policy for public read (if using ACL public-read)
4. CORS: Allow your frontend origin if needed
