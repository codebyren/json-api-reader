class JsonApiReader {
    constructor() {
        this.transformers = {};
        this.rel_cache = new Set();
    }
    setTransformer(type, method) {
        this.transformers[type] = method;
    }
    hasTransformer(type) {
        return this.transformers.hasOwnProperty(type);
    }
    transform(obj, type) {
        const transformer = type && this.hasTransformer(type) ? this.transformers[type] : false;
        return transformer && transformer instanceof Function
            ? transformer(obj)
            : obj;
    }
    makeRelationshipDescriptor(details) {
        return `${details.parent_type}_${details.parent_id}:${details.child_type}`.toUpperCase();
    }
    commitRelationship(details) {
        const descriptor = this.makeRelationshipDescriptor(details);
        this.rel_cache.add(descriptor);
    }
    canRecallRelationship(details) {
        const descriptor = this.makeRelationshipDescriptor(details);
        return this.rel_cache.has(descriptor);
    }
    parse(jsonResponse) {
        const invalid_data_message = "Unexpected input data format.";
        // @todo - JSON:API could have top-level node of "errors" instead of "data" if errors occurred.
        if (typeof jsonResponse !== "object" ||
            !jsonResponse.hasOwnProperty("data")) {
            throw new Error(invalid_data_message);
        }
        // For coding convenience, we'll be forcing single objects into an array
        // (we'll restore to initial object vs array of objects before return)
        let stash = [];
        const data = jsonResponse.data;
        const included = jsonResponse.included ? jsonResponse.included : [];
        // The "data" should be an object or array of objects
        if (!Array.isArray(data) && typeof data !== "object") {
            throw new Error(invalid_data_message);
        }
        // Here's where we force an array so code can always loop
        // even if there is only the one item inside the array.
        const items = Array.isArray(data) ? data : [data];
        items.forEach((item) => {
            const item_type = item.type; // book, author etc.
            const relationships = item.relationships;
            let record = Object.assign({ id: item.id }, item.attributes);
            record = this.transform(record, item_type);
            if (typeof relationships === "object") {
                Object.keys(relationships).forEach((k) => {
                    const rel = relationships[k];
                    const summary = rel.data; // object like { id: 123, type: 'user' } or an array of such items (or NULL!)
                    // Record that we are processing this relationship
                    // or abort early if we've' already processed it.
                    let rel_details = {
                        parent_type: item_type,
                        parent_id: item.id,
                        child_type: k,
                    };
                    if (this.canRecallRelationship(rel_details)) {
                        return;
                    }
                    this.commitRelationship(rel_details);
                    // Again, we're going to force array format for easy
                    // looping even when only dealing with one object.
                    let includes = [];
                    let summaries = Array.isArray(summary) ? summary : [summary];
                    summaries.forEach((s) => {
                        let matches = included.filter((incl) => {
                            return incl.id == (s === null || s === void 0 ? void 0 : s.id) && incl.type == (s === null || s === void 0 ? void 0 : s.type);
                        });
                        matches.forEach((match) => {
                            includes.push(this.parse({ data: match, included }));
                        });
                    });
                    // Restore to original structure (either single object or array of objects)
                    const relation_data = Array.isArray(summary)
                        ? includes
                        : includes.shift();
                    if (record.hasOwnProperty(k)) {
                        throw new Error(`Cannot set relation as '${k}' on object. Property name already in use.`);
                    }
                    else {
                        // Reminder: includes.shift() may produce undefined for empty array
                        record[k] =
                            typeof relation_data === "undefined" ? null : relation_data;
                    }
                });
            }
            stash.push(record);
        });
        // Now reset the cache of relationships processed in case this
        // instance of the reader is used to parse other responses.
        this.rel_cache = new Set();
        // Now return data in original jsonResponse format
        // (meaning a single object or array of objects)
        return Array.isArray(data) ? stash : stash.shift() || [];
    }
}

export { JsonApiReader as default };
//# sourceMappingURL=index.js.map
