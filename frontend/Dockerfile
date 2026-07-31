FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY index.html ./
COPY public ./public
COPY src ./src
COPY insightiq-image.png ./insightiq-image.png

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
