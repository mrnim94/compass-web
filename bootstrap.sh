#!/bin/bash

cd compass

npm ci

node_modules/.bin/lerna run bootstrap --stream --ignore @mongodb-js/mongodb-compass

npm run compile --workspace=@mongodb-js/compass-web 2>&1

npm run typescript --workspace=@mongodb-js/compass-web

# Avoid multiple react versions
rm -rf node_modules/react node_modules/react-dom