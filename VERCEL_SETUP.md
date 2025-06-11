# Vercel Deployment Setup

This document explains how to set up the Portfolio Chatbot for deployment on Vercel, focusing on environment variables and MongoDB connection.

## Environment Variables

For proper functioning of the serverless API, you need to set up the following environment variables in the Vercel dashboard:

1. **MONGODB_URI** - Your MongoDB connection string
2. **OPENAI_API_KEY** - Your OpenAI API key
3. **COHERE_API_KEY** - Your Cohere API key

### How to Add Environment Variables in Vercel

1. Go to your project in the Vercel dashboard
2. Navigate to Settings > Environment Variables
3. Add each of the above variables with their corresponding values
4. Make sure to click "Save" after adding each variable

Example of a MongoDB connection string:
```
mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
```

Note: The code is configured to use the `Portfolio` database and the `chatbot.chunks` collection, so make sure your MongoDB instance has this structure.

## MongoDB Database Structure

The application expects your MongoDB to have the following structure:
- Database: `Portfolio`
- Collection: `chatbot.chunks`

Each document in the `chunks` collection should have:
- `content`: String containing the text content
- `embedding`: Array of numbers representing the vector embedding

## Testing Database Connection

After deployment, you can test if your MongoDB connection is working by visiting:

```
https://your-vercel-domain.vercel.app/api/test-db
```

This endpoint will return information about your database connection status and the number of chunks found in your database.

## Troubleshooting

If you're experiencing issues with the MongoDB connection:

1. **Check Environment Variables**: Make sure the MONGODB_URI is correct and properly set in Vercel
2. **Network Access**: Ensure your MongoDB Atlas cluster has network access from anywhere (0.0.0.0/0) or specifically from Vercel's IP ranges
3. **Database User**: Verify the database user has read access to the collections
4. **Database Structure**: Confirm that your MongoDB has a `Portfolio` database with a `chatbot.chunks` collection
5. **Collection Data**: The chunks collection should contain documents with `content` and `embedding` fields

## Logs

To view logs from your serverless functions:

1. Go to your project in the Vercel dashboard
2. Navigate to "Deployments" and select the latest deployment
3. Click on "Functions" to see the deployed functions
4. Select a function to view its logs

These logs will help you diagnose any issues with the MongoDB connection or API endpoints. 