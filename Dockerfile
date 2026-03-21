FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --ignore-scripts
COPY . .
ENTRYPOINT ["node", "bin/cli.mjs"]
