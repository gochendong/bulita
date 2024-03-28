FROM node:14

WORKDIR /usr/app/bulita

COPY packages ./packages
COPY .env ./packages/web
COPY package.json tsconfig.json yarn.lock lerna.json .env ./

RUN yarn install

RUN yarn build:web

CMD yarn start
