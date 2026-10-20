/** Xã/phường of the province; `code` is the state administrative-unit code, the stable business key. */
export interface Ward {
  id: string;
  code: string;
  name: string;
}

export interface WardRepo {
  findById(id: string): Promise<Ward | null>;
  list(): Promise<Ward[]>;
}
