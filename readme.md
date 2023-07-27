# JsonApiReader

This is a small package to simplify reading records from APIs that implement the [json:api](https://jsonapi.org/) `v1.x` format.

See the [documentation site](https://codebyren.github.io/json-api-reader) for more details.

The primary goal is to unpack response data and produce an output that is easier to navigate.

A complicated (but very efficient) JSON:API response could be converted to something like this:

```javascript
// A sample article record with relationships.
{
	"id": 123,
	"title": "Some article title",
	"body": "Some long body text",
	"author": {
		"id": 99,
		"firstName": "Clark",
		"lastName": "Kent"
	},
	"comments": [
		{
			"id": 10,
			"content": "First!",
			"author": {
				"id": 100,
				"firstName": "Bruce",
				"lastName": "Wayne"
			}
		}
	]
}
```

Hope it helps.