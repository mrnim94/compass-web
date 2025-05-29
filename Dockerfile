# Stage 1: Build
FROM node:20 AS build

WORKDIR /app

COPY package.json package-lock.json LICENSE webpack.config.js lerna.json app.js ./
COPY src ./src
COPY lib ./lib
COPY polyfills ./polyfills

RUN npm ci

RUN npm run build && npm run build-server
# Remove devDependencies from node_modules
RUN npm prune --omit=dev

# Stage 2: Run
FROM node:20-slim

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/app.js ./
COPY --from=build /app/package.json ./
COPY --from=build /app/lib ./lib
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/LICENSE ./

ENV NODE_ENV=production

EXPOSE 8080

# MONGODB_URI can be set at runtime
CMD ["node", "app.js"]
