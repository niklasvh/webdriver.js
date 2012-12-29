/*
 * webdriver.js
 * https://github.com/niklasvh/webdriver.js
 *
 * Copyright (c) 2012 Niklas von Hertzen
 * Licensed under the MIT license.
 */

(function() {
  "use strict";
  var http = require("http"),
  URL = require("url");

  var Browser = function(options) {
    this.options = options || {};
    this.options.host = this.options.host || 'localhost';
    this.options.port = this.options.port || 4444;
    this.options.logging = (this.options.logging === undefined) ? false : this.options.logging;
    this.sessionId = null;
    this.queue = [];
    this.running = false;

    this.setup({
      browserName: this.options.browser || "firefox",
      version: "",
      javascriptEnabled: true,
      platform: "ANY"
    });
  };

  Browser.prototype.setup = function(capabilities) {
    this.command("/session", function(data) {
      this.version = data.version;
      this.sessionId = data['webdriver.remote.sessionid'];
    }, {
      desiredCapabilities: capabilities
    });
  };

  Browser.prototype.log = function(msg) {
    if (this.options.logging) {
      console.log.apply(null, arguments);
    }
  };

  Browser.prototype.command = function(cmd, callback, data, method, prepend) {
    this.queue[prepend ? "unshift" : "push"]([cmd, data, callback.bind(this), method || "POST"]);
    if (!this.running) {
      this.running = true;
      runBrowser(this);
    }
  };

  Browser.prototype.url = function(url, callback) {
    this.command("/session/:sessionId/url", callback || function() {}, {
      url: url
    });
    return this;
  };

  Browser.prototype.execute = function(func, args, callback) {
    this.command("/session/:sessionId/execute", callback || function() {}, {
      script: "return (" + func.toString() + ").apply(null, arguments);",
      args: args
    });
    return this;
  };

  Browser.prototype.executeAsync = function(func, args, callback) {
    this.command("/session/:sessionId/execute_async", callback || function() {}, {
      script: "return (" + func.toString() + ").apply(null, arguments);",
      args: args
    });
    return this;
  };

  Browser.prototype.$ = function(selector, callback) {
    var $ = new WebElements(this),
    self = this;

    var findElement = function(callback) {
      self.command("/session/:sessionId/elements", function(data) {
        data.forEach(function(item) {
          $.push(new WebElement(item.ELEMENT));
        });

        if (!$.loaded) {
          $.loaded = true;
          $.queue.reverse().forEach(function(queueArray){
            $[queueArray[0]].apply($, queueArray[1]);
          });
        }

        if (callback) {
          callback.call(self, $);
        }
      }, {
        using: "css selector",
        value: selector
      });
    };

    function setImplicitWait(ms) {
      self.command("/session/:sessionId/timeouts/implicit_wait", function() {},{
        ms: ms
      });
    }

    if (typeof callback === "number") {
      setImplicitWait(arguments[1]);
      findElement(arguments[2]);
      setImplicitWait(0);
    } else {
      findElement(callback);
    }

    return $;
  };

  var bindings = {
    forward: ["POST", "/session/:sessionId/forward"],
    back: ["POST", "/session/:sessionId/back"],
    refresh: ["POST", "/session/:sessionId/refresh"],
    close: ["DELETE", "/session/:sessionId/window"],
    source: ["GET", "/session/:sessionId/source"],
    title: ["GET", "/session/:sessionId/title"],
    screenshot: ["GET", "/session/:sessionId/screenshot"],
    status: ["GET", "/status"]
  };

  Object.keys(bindings).forEach(function(methodName){
    Browser.prototype[methodName] = function(callback) {
      this.command(bindings[methodName][1], callback || function() {}, undefined, bindings[methodName][0]);
      return this;
    };
  });

  function WebElements(browser) {
    this.contents = [];
    this.browser = browser;
    this.queue = [];
    this.loaded = false;
  }

  WebElements.prototype.push = function() {
    var self = this;
    Array.prototype.slice.call(arguments, 0).forEach(function(item){
      self.contents.push(item);
      item.container = self;
    });
  };

  WebElements.prototype.get = function(index) {
    return this.contents[index];
  };

  WebElements.prototype.$ = function() {
    return this.browser.$.apply(this.browser, arguments);
  };

  WebElements.prototype.val = function(value, callback) {
    if (this.loaded) {
      this.contents[0].command("/session/:sessionId/element/:id/value", callback || function() {}, {
        value: value.split('')
      }, "POST");
    } else {
      this.queue.push(["val", arguments]);
    }
    return this;
  };

  var webElementCommands = {
    "submit": {
      url: "/session/:sessionId/element/:id/submit",
      method: "POST"
    },
    "click": {
      url: "/session/:sessionId/click",
      method: "POST"
    },
    "attr": {
      url: "/session/:sessionId/element/:id/attribute/",
      method: "GET"
    },
    "size": {
      url: "/session/:sessionId/element/:id/size",
      method: "GET"
    },
    "css": {
      url: "/session/:sessionId/element/:id/css/",
      method: "GET"
    }
  };

  Object.keys(webElementCommands).forEach(function(methodName){
    var action = webElementCommands[methodName];

    WebElements.prototype[methodName] = function(callback) {
      var targetUrl = action.url;
      if (action.method === "GET" && targetUrl.substr(-1) === "/") {
        targetUrl += arguments[0];
        callback = arguments[1];
      }

      if (this.loaded) {
        this.contents[0].command(targetUrl, callback || function() {}, undefined, action.method);
      } else {
        this.queue.push([methodName, arguments]);
      }
      return this;
    };
  });

  WebElements.prototype.width = function(callback) {
    var self = this;
    this.size(function(size){
      callback.call(self, size.width);
    });
    return this;
  };

  WebElements.prototype.height = function(callback) {
    var self = this;
    this.size(function(size){
      callback.call(self, size.height);
    });
    return this;
  };

  function WebElement(id) {
    this.id = id;
    this.container = null;
  }

  WebElement.prototype.command = function() {
    var args = Array.prototype.slice.call(arguments, 0);
    args[0] = arguments[0].replace(":id", this.id);
    args[4] = true;
    this.container.browser.command.apply(this.container.browser, args);
  };

  function runBrowser(browser) {
    if (browser.queue.length > 0) {
      var item = browser.queue.shift();
      browser.log(item[3], item[0], item[1]);
      performRequest(requestOptions(browser, item[0], item[3]), item[1], function() {
        item[2].apply(browser, arguments);
        runBrowser(browser);
      });
    } else {
      browser.running = false;
    }
  }

  function requestOptions(browser, cmd, method) {
    return {
      host: browser.options.host,
      port: browser.options.port,
      method: method,
      path: '/wd/hub' + ((browser.sessionId !== null) ? cmd.replace(":sessionId", browser.sessionId) : cmd)
    };
  }

  function requestHeaders(data) {
    return {
      'content-type': "application/json",
      'Accept': "application/json",
      'charset': "charset=UTF-8",
      'content-length': (data) ? JSON.stringify(data).length : 0
    };
  }

  function performRequest(options, data, callback) {
    options.headers = requestHeaders(data);

    var request = http.request(options, responseHandler.bind(null, callback));
    if (data) {
      request.write(JSON.stringify(data));
    }

    request.end();
  }

  var validResponseCharacters = function(str) {
    return str.charCodeAt(0);
  };

  function trimResponse(data) {
    return data.join('').split('').filter(validResponseCharacters).join('');
  }

  function parseResponseData(data) {
    return (data.length > 0) ? JSON.parse(trimResponse(data)) : {
      status: 0
    };
  }

  function responseRedirect(callback, response) {
    if (response.statusCode === 302) {
      var url = URL.parse(response.headers.location),
      options = {
        host: url.hostname,
        port: url.port,
        path: url.path,
        headers: requestHeaders(),
        method: "GET"
      };
      http.get(options, responseHandler.bind(null, callback));
      return true;
    }
    return false;
  }

  var responseHandler = function(callback, response) {
    if (!responseRedirect(callback, response)) {
      var dataArray = [];

      response.on('data', Array.prototype.push.bind(dataArray));
      response.on('end', function () {
        var data = parseResponseData(dataArray);

        if (data.status !== 0) {
          throw new Error(data.value.message);
        } else {
          callback(data.value);
        }
      });
    }
  };

  exports.webdriver = Browser;
})();