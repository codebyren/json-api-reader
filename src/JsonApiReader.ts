// This represents the simple object that we feed
// into transformer (if any) specified by user.
// It's just a merging of id (required) and
// the remaining attributes of the object.
interface ITransformableItem {
  id: string;
  [key: string]: any;
}

// Users can provide transformers to transform data
// to their desired formats once parsing is done.
// The transformer can be provided as a class
// with a transform method. Or a callback fn.
interface ITransformerClass {
  transform(obj: ITransformableItem): any; // Output is up to user. So genuinely "any".
}

// Just the container for all the user-provided transformers
// indexed by resource type that they are to be used for.
interface IListOfTransformers {
  [key: string]: ITransformerClass | Function; // e.g { book: BookTransformer, author: callbackFunction }
}

// This is what a JSON:API response looks like at the top level.
interface IJsonResponse {
  data?: IJsonApiResourceObject | IJsonApiResourceObject[]; // single item or array of items
  included?: IJsonApiResourceObject[];
  errors?: object[];
}

// This is what the records in the JSON:API response look like.
interface IJsonApiResourceObject {
  id: string;
  type: string;
  attributes: object;
  relationships?: IListOfRelationships;
  links?: object;
  meta?: object;
}

// For empty to-one relationships in the JSON:API response.
type TResourceLinkObjectNull = null;

// For empty to-many relationships in the JSON:API response.
type TResourceLinkObjectEmpty = [];

// Reminder: Since we're only handling JSON:API *responses*, we don't worry about "lid" (local ID)
// which gets used for resources that exist client side but have not yet been created server-side.
// https://jsonapi.org/format/#document-resource-identifier-objects
interface IResourceIdentifierObject {
  id: string;
  type: string;
  meta?: object;
}

// Each relationship node in the JSON:API response is basically
// a short pointer to the full record in the "included" node.
interface RelationshipObject {
  data:
    | IResourceIdentifierObject
    | IResourceIdentifierObject[]
    | TResourceLinkObjectNull
    | TResourceLinkObjectEmpty;
  links?: object;
  meta?: object;
}

// The container for all relationships included in the JSON:API response.
interface IListOfRelationships {
  [key: string]: RelationshipObject;
}

// We'll keep a record of descriptors that define relationships
// already processed in order to prevent recursion where one
// record has a parent AND child relationship to another.
// "{PARENT_TYPE}_{PARENT_ID}:{CHILD_RELATION_TYPE}"
// E.g. "comment_123:author"
interface IProcessedRelationshipTransportObject {
  parent_type: string;
  parent_id: string;
  child_type: string;
}

export default class JsonApiReader {
  transformers: IListOfTransformers = {};
  rel_cache: Set<string> = new Set();

  setTransformer(type: string, transformer: ITransformerClass | Function): void {
    this.transformers[type] = transformer;
  }

  hasTransformer(type: string): boolean {
    return this.transformers.hasOwnProperty(type);
  }

  transform(obj: ITransformableItem, type: string): any {
    const transformer =
      type && this.hasTransformer(type) ? this.transformers[type] : false;
    const callback = (typeof transformer === 'object' && transformer.hasOwnProperty('transform'))
      ? transformer.transform
      : transformer;

    return callback && callback instanceof Function
      ? callback(obj)
      : obj;
  }

  makeRelationshipDescriptor(
    details: IProcessedRelationshipTransportObject
  ): string {
    return `${details.parent_type}_${details.parent_id}:${details.child_type}`.toUpperCase();
  }

  commitRelationship(details: IProcessedRelationshipTransportObject): void {
    const descriptor = this.makeRelationshipDescriptor(details);
    this.rel_cache.add(descriptor);
  }

  canRecallRelationship(
    details: IProcessedRelationshipTransportObject
  ): boolean {
    const descriptor = this.makeRelationshipDescriptor(details);
    return this.rel_cache.has(descriptor);
  }

  parse(jsonResponse: IJsonResponse): any | any[] {
    const invalid_data_message = "Unexpected input data format.";

    // @todo - JSON:API could have top-level node of "errors" instead of "data" if errors occurred.
    if (
      typeof jsonResponse !== "object" ||
      !jsonResponse.hasOwnProperty("data")
    ) {
      throw new Error(invalid_data_message);
    }

    // For coding convenience, we'll be forcing single objects into an array
    // (we'll restore to initial object vs array of objects before return)
    let stash: any[] = [];
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
      let record: ITransformableItem = Object.assign(
        { id: item.id },
        item.attributes
      );
      record = this.transform(record, item_type);

      if (typeof relationships === "object") {
        Object.keys(relationships).forEach((k) => {
          const rel = relationships[k];
          const summary = rel.data; // object like { id: 123, type: 'user' } or an array of such items (or NULL!)

          // Record that we are processing this relationship
          // or abort early if we've' already processed it.
          let rel_details: IProcessedRelationshipTransportObject = {
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
          let includes: any[] = [];
          let summaries = Array.isArray(summary) ? summary : [summary];

          summaries.forEach((s) => {
            let matches = included.filter((incl) => {
              return incl.id == s?.id && incl.type == s?.type;
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
            throw new Error(
              `Cannot set relation as '${k}' on object. Property name already in use.`
            );
          } else {
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
