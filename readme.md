# JsonApiReader

This is a basic package to simplify consuming APIs that implement the [json:api](https://jsonapi.org/) `v1.x` format.

The primary goal is to unpack response data and make it available in a logical and readable way.
The library is not concerned with meta data like pagination, navigating internal links etc.

```javascript
// Assume a list of blog posts is fetched via the browser's native fetch method:
const response = await fetch('https://example.com/blog/posts.json?include=author,comments');
const json = await response.json();

// Create a reader to process the json response
const reader = new JsonApiReader();
const posts = reader.parse(json);

// Now loop through the data from the response in a sane way.
posts.forEach(post => {
	const post_title = post.title;
	const comments = post.comments;
	const author = post.author;
});
```

You can also optionally specify transformers to convert items in the JSON to custom objects for convenience:

```javascript
const reader = new JsonApiReader();
reader.setTransformer('post', obj => {
	let customPost = {};
	customPost.id = parseInt(obj.id, 10); // we want our id values as integers
	customPost.is_new = (new SomeDateLibrary(post.created_at)).isNewerThan('-24 hours');
	// ...
	return customPost;
});
```

Hope it helps.