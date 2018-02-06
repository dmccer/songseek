#!/bin/bash

rm -r ./build
yarn build
cp ./package.json ./build
cd build
yarn --production
cd ../

mkdir -p deploy
DATE=$(date +%Y-%m-%d)
zip -r ./deploy/$DATE-pbc-crawler.zip ./build