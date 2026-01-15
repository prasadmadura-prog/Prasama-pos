# Use the official Node.js 18 image as the base
# You can change '18-alpine' to a more specific version or a different base image
# if your application requires it (e.g., 'node:20-slim').
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if you use it)
# This step is done separately to leverage Docker's caching.
# If only your code changes, these layers won't need to be rebuilt.
COPY package*.json ./

# Install application dependencies
# Using --production will install only production dependencies,
# which is good for smaller image sizes in production.
RUN npm install --production

# Copy the rest of your application code into the container
COPY . .

# Cloud Run services must listen on the port defined by the PORT environment variable.
# By default, Cloud Run sets PORT to 8080.
ENV PORT 8080
EXPOSE $PORT

# Command to start your application
# This assumes you have a "start" script defined in your package.json (e.g., "start": "node index.js").
# If your main application file is different (e.g., app.js), you might need to change this to:
# CMD ["node", "app.js"]
CMD ["npm", "start"]

