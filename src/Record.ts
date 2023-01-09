interface ListOfRelations {
  [key: string]: null | object | object[];
}

interface IRecord {
  [key: string]: any;
  __relations: ListOfRelations;
  setRelation(type: string, values: null | object | object[]): this;
  getRelated(type: string, fallback: any): any;
}

export default class Record implements IRecord {
  __relations: ListOfRelations = {};

  setRelation(type: string, values: null | object | object[]): this {
    this.__relations[type] = values;
    return this;
  }

  getRelated(type: string, fallback: any): any {
    // I guess the fallback type is up to the consuming application?
    if (this.__relations.hasOwnProperty(type)) {
      return this.__relations[type];
    }
    return fallback;
  }
}
