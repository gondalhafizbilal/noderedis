process.env.NODE_ENV = "test";

var test = require("ava");
var servertest = require("servertest");

var server = require("../lib/server");

test.serial.cb("healthcheck", function (t) {
  var url = "/health";
  servertest(server(), url, { encoding: "json" }, function (err, res) {
    t.falsy(err, "no error");

    t.is(res.statusCode, 200, "correct statusCode");
    t.is(res.body.status, "OK", "status is ok");
    t.end();
  });
});

test.serial.cb("Getalltargets", function (t) {
  var url = "/api/targets";
  servertest(server(), url, { encoding: "json" }, function (err, res) {
    t.falsy(err, "no error");

    t.is(res.statusCode, 200, "correct statusCode");
    t.is(res.body.status, "OK", "status is ok");
    t.end();
  });
});

test.serial.cb("Addnewtarget", function (t) {
  var url = "/api/targets";
  servertest(server(), url, { encoding: "json" }, function (err, res) {
    t.falsy(err, "no error");

    t.is(res.statusCode, 200, "correct statusCode");
    t.is(res.body.status, "OK", "status is ok");
    t.end();
  });
});

test.serial.cb("Getagainsttargetid", function (t) {
  var url = "/api/targets";
  servertest(server(), url, { encoding: "json" }, function (err, res) {
    t.falsy(err, "no error");

    t.is(res.statusCode, 200, "correct statusCode");
    t.is(res.body.status, "OK", "status is ok");
    t.end();
  });
});

test.serial.cb("updatetarget", function (t) {
  var url = "/api/targets";
  servertest(server(), url, { encoding: "json" }, function (err, res) {
    t.falsy(err, "no error");

    t.is(res.statusCode, 200, "correct statusCode");
    t.is(res.body.status, "OK", "status is ok");
    t.end();
  });
});

test.serial.cb("checkroute", function (t) {
  var url = "/route";
  servertest(
    server(),
    url,
    { encoding: "json", method: "POST" },
    function (err, res) {
      t.falsy(err, "no error");

      t.is(res.statusCode, 200, "correct statusCode");
      t.is(res.body.status, "OK", "status is ok");
      t.end();
    }
  );
});
