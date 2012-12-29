# webdriver.js

jQuery styled WebDriver bindings for node.js

## Getting Started

Install the module with:

    $ npm install webdriver.js

## Documentation

Launch the <a href="http://code.google.com/p/selenium/downloads/list">Selenium server</a> with:

    $ java -jar path/to/selenium-server-standalone-2.xx.x.jar

Run tests

    $ grunt test

## Examples

```javascript
var WebDriver = require('webdriver.js').webdriver;
var browser = new WebDriver();
browser.url("http://google.com/")
.$('input[name=q]').val('hello world!')
.$('form[action="/search"]').submit();
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/gruntjs/grunt).

## Release History
_(Nothing yet)_

## License
Copyright (c) 2012 Niklas von Hertzen
Licensed under the MIT license.
