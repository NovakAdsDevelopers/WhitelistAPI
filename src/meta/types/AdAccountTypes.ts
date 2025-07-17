export type AdAccount = {
  name: string;
  account_id: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  amount_spent: string;
  spend_cap: string;
  balance: string;
  id: string;
};

export type PagingCursors = {
  before: string;
  after: string;
};

export type Paging = {
  cursors: PagingCursors;
  next: string;
};

export type AdAccountsResponse = {
  data: AdAccount[];
  paging: Paging;
};