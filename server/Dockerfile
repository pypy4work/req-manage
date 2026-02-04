FROM node:18-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY src ./src
EXPOSE 4000
CMD ["node", "src/index.js"]
