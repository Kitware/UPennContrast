class Persister {
  private readonly store: Storage;
  constructor(store = window.localStorage) {
    this.store = store;
  }
  get<T>(key: string, defaultValue: T): T {
    const r = this.store.getItem(key);
    return r === null ? defaultValue : (JSON.parse(r) as T);
  }
  set<T>(key: string, value: T): T {
    this.store.setItem(key, JSON.stringify(value));
    return value;
  }
  delete(key: string) {
    const r = this.store.getItem(key);
    this.store.removeItem(key);
    return r != null;
  }
}

export default new Persister();
