# MongoDB Compass Web

![npm](https://img.shields.io/npm/v/compass-web.svg)
![downloads](https://img.shields.io/npm/dw/compass-web)

MongoDB Compass that runs on a browser. Most of the features on [MongoDB Compass](https://www.mongodb.com/products/tools/compass) desktop application are available on the browser. Visit the [frontend-only demo](https://haohanyang.github.io/compass-web/).

![screenshot1](/images/screenshot1.png)
![screenshot2](/images/screenshot2.png)

## Get started

- npm

```
npx compass-web -p 8080
```

- Docker

```
docker run -it --rm -p 8080:8080 haohanyang/compass-web

```

Then access your MongoDB compass on http://localhost:8080

## Credits

- [MongoDB Compass](https://github.com/mongodb-js/compass)

## License

[Server Side Public License](/LICENSE)
