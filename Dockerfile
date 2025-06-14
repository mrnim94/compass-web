FROM node:22-slim

ARG COMPASS_WEB_VERSION=latest

RUN npm i -g compass-web@${COMPASS_WEB_VERSION}

USER node

EXPOSE 8080

CMD [ "compass-web", "--host", "0.0.0.0" ]