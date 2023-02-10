import { RestClientInstance } from "@/girder";
import { logError } from "@/utils/log";

export async function fetchAllPages(
  client: RestClientInstance,
  endpoint: string,
  datasetId: string,
  limit: number = 1000
) {
  const pages: any[] = [];
  let totalCount = -1;

  const fetchPage = async (offset: number) =>
    await client
      .get(
        `${endpoint}?datasetId=${datasetId}&limit=${limit}&offset=${offset}&sort=_id`
      )
      .then((res: any) => {
        totalCount = Number(res.headers["girder-total-count"]);
        pages.push(res.data);
        return true;
      })
      .catch((err: any) => {
        logError(
          `Could not get all ${endpoint} pages for dataset ${datasetId}:\n${err}`
        );
        return false;
      });

  // Fetch first page
  if (!(await fetchPage(0))) {
    return [];
  }

  // Fetch remaining pages if needed
  for (let offset = limit; offset < totalCount; offset += limit) {
    if (!(await fetchPage(offset))) {
      return [];
    }
  }

  return pages;
}
