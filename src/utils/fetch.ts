import { RestClientInstance } from "@/girder";
import { logError } from "@/utils/log";
import { AxiosRequestConfig } from "axios";

export async function fetchAllPages(
  client: RestClientInstance,
  endpoint: string,
  baseFormData?: AxiosRequestConfig,
  firstPage?: number,
  progressCallback?: (fetched: number, total: number) => void,
) {
  const pages: any[] = [];
  let totalCount = -1;
  const baseParams = {
    limit: 100000,
    sort: "_id",
    ...baseFormData?.params,
    offset: 0,
  };
  const basePageSize = baseParams.limit;
  const firstPageSize = firstPage === undefined ? basePageSize : firstPage;

  let downloaded = 0;
  const fetchPage = async (offset: number, limit: number) => {
    const formData: AxiosRequestConfig = {
      ...baseFormData,
      params: {
        ...baseParams,
        offset,
        limit,
      },
    };
    try {
      const res = await client.get(endpoint, formData);
      totalCount = Number(res.headers["girder-total-count"]);
      pages.push(res.data);
      downloaded += res.data.length;
      progressCallback?.(downloaded, totalCount);
    } catch (err) {
      logError(`Could not get all ${endpoint} pages:\n${err}`);
      throw err;
    }
  };

  try {
    // Fetch first page
    await fetchPage(0, firstPageSize);

    // Fetch remaining pages if needed
    const promises: Promise<any>[] = [];
    for (
      let offset = firstPageSize;
      offset < totalCount;
      offset += basePageSize
    ) {
      promises.push(fetchPage(offset, basePageSize));
    }
    await Promise.all(promises);
  } catch {
    return [];
  }

  return pages;
}
