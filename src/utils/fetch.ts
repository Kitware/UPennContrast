import { RestClientInstance } from "@/girder";
import { logError } from "@/utils/log";
import { AxiosRequestConfig } from "axios";

export async function fetchAllPages(
  client: RestClientInstance,
  endpoint: string,
  baseFormData?: AxiosRequestConfig
) {
  const pages: any[] = [];
  let totalCount = -1;
  const formData: AxiosRequestConfig = { ...baseFormData };
  const params = { limit: 1000, sort: "_id", ...formData.params, offset: 0 };
  formData.params = params;

  const fetchPage = () =>
    client
      .get(endpoint, formData)
      .then((res: any) => {
        totalCount = Number(res.headers["girder-total-count"]);
        pages.push(res.data);
        return true;
      })
      .catch((err: any) => {
        logError(`Could not get all ${endpoint} pages:\n${err}`);
        return false;
      });

  // Fetch first page
  if (!(await fetchPage())) {
    return [];
  }

  // Fetch remaining pages if needed
  for (
    params.offset = params.limit;
    params.offset < totalCount;
    params.offset += params.limit
  ) {
    if (!(await fetchPage())) {
      return [];
    }
  }

  return pages;
}
