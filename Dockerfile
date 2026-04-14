FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NODE_ENV=production

USER pwuser

EXPOSE 4000

CMD ["node", "server.js"]