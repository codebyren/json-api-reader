import Record from "./Record";

interface Transformer {
  transform(): TransformedItem;
}

interface TransformedItem {
  [key: number | string]: any;
}

interface ListOfRelationships {
  [key: string]: RelationshipObject;
}

interface JsonApiResourceObject {
  id: string;
  type: string;
  attributes: object;
  relationships?: ListOfRelationships;
  links?: object;
  meta?: object;
}

// Reminder: Since we're only handling JSON:API *responses*, we don't worry about "lid" (local ID)
// which gets used for resources that exist client side but have not yet been created server-side.
// https://jsonapi.org/format/#document-resource-identifier-objects
interface ResourceIdentifierObject {
  id: string;
  type: string;
  meta?: object;
}

// For empty to-one relationships.
type ResourceLinkObjectNull = null;

// For empty to-many relationships.
type ResourceLinkObjectEmpty = [];

interface RelationshipObject {
  data:
    | ResourceIdentifierObject
    | ResourceIdentifierObject[]
    | ResourceLinkObjectNull
    | ResourceLinkObjectEmpty;
  links?: object;
  meta?: object;
}

interface JsonResponse {
  data?: JsonApiResourceObject | JsonApiResourceObject[]; // single item or array of items
  included?: JsonApiResourceObject[];
  errors?: object[];
}

interface TransformerArray {
  [key: string]: any;
}

export default class JsonApiReader {
  transformers: TransformerArray = {};

  setTransformer(type: string, method: Transformer): void {
    this.transformers[type] = method;
  }

  hasTransformer(type: string): boolean {
    return this.transformers.hasOwnProperty(type);
  }

  transform(obj: object, type: string): TransformedItem {
    const transformer =
      type && this.hasTransformer(type) ? this.transformers[type] : false;

    return transformer && transformer instanceof Function
      ? transformer(obj)
      : obj;
  }

  parse(jsonResponse: JsonResponse): Record | Record[] {
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
    let stash: Record[] = [];
    const data = jsonResponse.data;
    const included = jsonResponse.included ? jsonResponse.included : [];

    // The "data" should be an object or array of objects
    if (!Array.isArray(data) && typeof data !== "object") {
      throw new Error(invalid_data_message);
    }

    // Here's where we force an array so code can always loop
    // even if there is only the one item inside the array.
    const is_array = Array.isArray(data);
    const items = is_array ? data : [data];

    items.forEach((item) => {
      let record = new Record();
      const type = item.type;
      const relationships = item.relationships;
      let entity = this.transform(
        Object.assign({}, { id: item.id }, item.attributes),
        type
      );

      Object.keys(entity).forEach((key) => {
        record[key as keyof Record] = entity[key];
      });

      if (typeof relationships === "object") {
        Object.keys(relationships).forEach((k) => {
          const rel = relationships[k];
          const summary = rel.data; // object like { id: 123, type: 'user' } or an array of such items

          // Again, we're going to force array format for easy
          // looping even when only dealing with one object.
          let includes: object[] = [];
          let summaries = Array.isArray(summary) ? summary : [summary];

          summaries.forEach((s) => {
            let matches = included.filter((incl) => {
              return incl.id == s?.id && incl.type == s?.type;
            });

            matches.forEach((match) => {
              let innerRelationships = match.relationships || {};
              if (Object.keys(innerRelationships).length > 0) {
                // Need to do some recursion
                includes.push(this.parse({ data: match, included }));
              } else {
                // Just need to transform this item
                // includes.push(this.transform(match, match.type));
                includes.push(this.parse({ data: match, included }));
              }
            });
          });

          // Restore to original structure (either single object or array of objects)
          const relation_data = Array.isArray(summary)
            ? includes
            : includes.shift();
          record.setRelation(
            k,
            typeof relation_data === "undefined" ? null : relation_data
          ); // includes.shift() may produce undefined for empty array
        });
      }

      stash.push(record);
    });

    // Now return data in original jsonResponse format
    // (meaning a single object or array of objects)
    return Array.isArray(data) ? stash : stash.shift() || [];
  }
}
