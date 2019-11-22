export { Upload } from "@girder/components/src/components";
export { vuetifyConfig } from "@girder/components/src/utils";
export * from "@girder/components/src";
export { default } from "@girder/components/src";
export { FileManager } from "@girder/components/src/components/Snippet";

import {
  RestClient,
  IGirderItem,
  IGirderFolder,
  IGirderFile
} from "@girder/components/src";

function toId(item: string | { _id: string }) {
  return typeof item === "string" ? item : item._id;
}

export class RestClientHelper {
  private readonly client: RestClient;

  constructor(client: RestClient) {
    this.client = client;
  }

  getItem(itemId: string): Promise<IGirderItem> {
    return this.client.get(`item/${itemId}`).then(r => r.data);
  }
  getFolder(folderId: string): Promise<IGirderFolder> {
    return this.client.get(`folder/${folderId}`).then(r => r.data);
  }
  getFiles(item: string | IGirderItem): Promise<IGirderFile[]> {
    return this.client.get(`item/${toId(item)}/files`).then(r => r.data);
  }
  downloadUrl(item: string | IGirderItem) {
    return `${this.client.apiRoot}/item/${toId(
      item
    )}/download?contentDisposition=inline`;
  }

  getImage(item: string | IGirderItem) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = evt => reject(evt);
      image.src = this.downloadUrl(item);
    });
  }
}
