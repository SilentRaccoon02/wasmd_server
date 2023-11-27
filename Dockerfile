FROM node

WORKDIR /app

COPY ./package.json .

RUN npm install --omit=dev

COPY ./build ./build

ENV PORT 2512

EXPOSE $PORT

CMD ["node", "./build/index.js"]
