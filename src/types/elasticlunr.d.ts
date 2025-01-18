declare module "elasticlunr" {
  interface ElasticLunrOptions {
    fields: {
      [key: string]: { boost: number };
    };
  }

  interface ElasticLunrIndex {
    addField(fieldName: string): void;
    setRef(refName: string): void;
    addDoc(doc: any): void;
    search(query: string, options?: ElasticLunrOptions): Array<{ ref: string; score: number }>;
    documentStore: {
      getDoc(ref: string): any;
    };
  }

  interface ElasticLunrStatic {
    (setup?: (this: ElasticLunrIndex) => void): ElasticLunrIndex;
  }

  const elasticlunr: ElasticLunrStatic;
  export default elasticlunr;
}
