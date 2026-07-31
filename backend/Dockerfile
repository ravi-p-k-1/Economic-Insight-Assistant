FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src ./src

EXPOSE 3001

CMD ["node", "src/server.js"]
