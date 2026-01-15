# Multistage build for a Vite React/TypeScript app
# Stage 1: Build the app
FROM node:18-alpine AS build
WORKDIR /app

# Accept build arguments for Firebase config
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID

# Set environment variables for build
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

COPY package*.json ./
RUN npm ci --silent
COPY . .
RUN npm run build

# Stage 2: Serve the built files with nginx
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
ENV PORT 8080
EXPOSE 8080
CMD ["sh", "-c", "sed -i 's/8080/'$PORT'/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
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

>>>>>>> 12c3047c2a9a883d177ffcc902ff904aaee8dff4
