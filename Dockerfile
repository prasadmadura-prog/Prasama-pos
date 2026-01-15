# Multistage build for a Vite React/TypeScript app
# Stage 1: Build the app
FROM node:18-alpine AS build
WORKDIR /app
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

