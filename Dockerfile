FROM node:22.16.0-slim

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
