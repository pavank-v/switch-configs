# Stage 1: build the React application

FROM node:22-alpine AS build

WORKDIR /app

# Cache dependency installation when application code changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


# Stage 2: serve the static files
FROM nginx:stable-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD [ "nginx", "-g", "daemon off;" ]
