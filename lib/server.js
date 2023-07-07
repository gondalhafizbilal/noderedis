var URL = require("url");
var http = require("http");
var cuid = require("cuid");
var Corsify = require("corsify");
var sendJson = require("send-data/json");
var ReqLogger = require("req-logger");
var healthPoint = require("healthpoint");
var HttpHashRouter = require("http-hash-router");

var redis = require("./redis");
var version = require("../package.json").version;

var router = HttpHashRouter();
var logger = ReqLogger({ version: version });
var health = healthPoint({ version: version }, redis.healthCheck);
var cors = Corsify({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, accept, content-type",
});

var { createClient } = require("redis");
const client = createClient({
  // legacyMode: true,
  PORT: 5001,
});
client.connect().catch(console.error);

router.set("/favicon.ico", empty);

module.exports = function createServer() {
  return http.createServer(cors(handler));
};

async function handler(req, res) {
  const parsedUrl = URL.parse(req.url, true);
  if (req.url === "/health") return health(req, res);
  if (req.url === "/route" && req.method === "POST") {
    const bodyData = JSON.parse(await getBody(req));
    const { geoState, publisher, timestamp } = bodyData;
    if (geoState && publisher && timestamp) {
      const getTargets = await client.get("targets");
      const getRoutes = await client.get("route");
      let parseRoute;
      if (getRoutes === null) {
        parseRoute = null;
      } else {
        parseRoute = JSON.parse(getRoutes);
      }

      if (getTargets === null) {
        res.statusCode = 200;
        return sendJson(req, res, {
          status: "OK",
          decision: "reject",
        });
      }
      const parseTargets = JSON.parse(getTargets);
      const hour = getDateHour(timestamp);
      let dataArray = [];
      const filterTarget = parseTargets.filter((obj) => {
        if (
          obj.accept.geoState.$in.includes(geoState) &&
          obj.accept.hour.$in.includes(hour)
        ) {
          if (parseRoute !== null) {
            const checkRoute = parseRoute.filter((object) => {
              if (object.id === obj.id) {
                if (object.date === new Date().toJSON().slice(0, 10)) {
                  return object.count < obj.maxAcceptsPerDay;
                } else {
                  return true;
                }
              }
            });
            if (checkRoute.length > 0) {
              return obj;
            }
          } else {
            return obj;
          }
        }
      });
      if (filterTarget.length === 0) {
        res.statusCode = 200;
        return sendJson(req, res, {
          status: "OK",
          decision: "reject",
        });
      }

      const maxObjects = filterTarget.reduce((maxObjects, obj) => {
        if (!maxObjects.length || obj.value > maxObjects[0].value) {
          return [obj];
        } else if (obj.value === maxObjects[0].value) {
          maxObjects.push(obj);
        }
        return maxObjects;
      }, []);

      if (parseRoute === null) {
        for (let i = 0; i < maxObjects.length; i++) {
          let data = {
            id: maxObjects[i].id,
            count: 1,
            date: new Date().toJSON().slice(0, 10),
          };
          dataArray.push(data);
        }
        client.set("route", JSON.stringify(dataArray));
      } else {
        const findInRoute = parseRoute.map((value) => {
          for (let i = 0; i < maxObjects.length; i++) {
            if (value.id === maxObjects[i].id) {
              return { ...value, count: value.count + 1 };
            }
          }
        });
        client.set("route", JSON.stringify(findInRoute));
      }

      res.statusCode = 200;
      return sendJson(req, res, {
        status: "OK",
      });
    }
  }
  if (req.url === "/api/targets" && req.method === "GET") {
    const response = await client.get("targets");

    res.statusCode = 200;
    return sendJson(req, res, {
      status: "OK",
      response: JSON.parse(response),
    });
  }
  if (req.url === "/api/targets" && req.method === "POST") {
    const response = await client.get("targets");

    if (response !== null) {
      const parseData = JSON.parse(response);

      const lastObject = parseData[parseData.length - 1];
      const newId = lastObject.id + 1;
      let data = {
        id: newId,
        url: "http://example.com",
        value: "0.50",
        maxAcceptsPerDay: "10",
        accept: {
          geoState: {
            $in: ["ca", "ny"],
          },
          hour: {
            $in: ["13", "23", "15"],
          },
        },
      };
      parseData.push(data);
      client.set("targets", JSON.stringify(parseData));
    } else {
      let dataArray = [];
      let data = {
        id: 1,
        url: "http://example.com",
        value: "0.50",
        maxAcceptsPerDay: "10",
        accept: {
          geoState: {
            $in: ["ca", "ny"],
          },
          hour: {
            $in: ["13", "14", "15"],
          },
        },
      };
      dataArray.push(data);
      client.set("targets", JSON.stringify(dataArray));
    }

    res.statusCode = 200;
    return sendJson(req, res, {
      status: "OK",
    });
  }
  if (parsedUrl.pathname === "/api/target/" && req.method === "GET") {
    const queryId = parseInt(parsedUrl.query.id);
    const response = await client.get("targets");
    const parseData = JSON.parse(response);
    const findOne = parseData.filter((obj) => obj.id === queryId);
    res.statusCode = 200;
    return sendJson(req, res, {
      status: "OK",
      response: findOne,
    });
  }
  if (parsedUrl.pathname === "/api/target/" && req.method === "POST") {
    const queryId = parseInt(parsedUrl.query.id);
    const bodyData = JSON.parse(await getBody(req));
    const response = await client.get("targets");
    const parseData = JSON.parse(response);
    const updatedProducts = parseData.map((target) => {
      if (target.id === queryId) {
        let data = {};
        if (bodyData.url !== undefined) {
          data.url = bodyData.url;
        }
        if (bodyData.value !== undefined) {
          data.value = bodyData.value;
        }
        if (bodyData.maxAcceptsPerDay !== undefined) {
          data.maxAcceptsPerDay = bodyData.maxAcceptsPerDay;
        }
        return { ...target, ...data };
      }
      return target;
    });

    client.set("targets", JSON.stringify(updatedProducts));

    res.statusCode = 200;
    return sendJson(req, res, {
      status: "OK",
      response: updatedProducts,
    });
  }
  req.id = cuid();
  logger(req, res, { requestId: req.id }, function (info) {
    info.authEmail = (req.auth || {}).email;
    console.log(info);
  });
  router(req, res, { query: getQuery(req.url) }, onError.bind(null, req, res));
}
async function getBody(req) {
  let requestBody = "";
  await req.on("data", async (chunk) => {
    requestBody += await chunk;
  });
  let dt = await req.on("end", () => {
    return requestBody;
  });
  return requestBody;
}
function onError(req, res, err) {
  if (!err) return;

  res.statusCode = err.statusCode || 500;
  logError(req, res, err);

  sendJson(req, res, {
    error: err.message || http.STATUS_CODES[res.statusCode],
  });
}

function logError(req, res, err) {
  if (process.env.NODE_ENV === "test") return;

  var logType = res.statusCode >= 500 ? "error" : "warn";

  console[logType](
    {
      err: err,
      requestId: req.id,
      statusCode: res.statusCode,
    },
    err.message
  );
}

function empty(req, res) {
  res.writeHead(204);
  res.end();
}

function getQuery(url) {
  return URL.parse(url, true).query; // eslint-disable-line
}

function getDateHour(dateString) {
  const hour = dateString.substring(11, 13);
  return hour;
}
