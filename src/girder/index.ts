export interface IGirderUser {
  login: string;
}

export interface IGirderRestClient {
  user: IGirderUser | null;
  token: string;
}
