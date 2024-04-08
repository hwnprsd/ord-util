import axios from "axios";

export interface TxOutResponse {
  id: number;
  jsonrpc: string;
  result: TxOutPoint[];
}

export interface TxOutPoint {
  height: number;
  tx_hash: string;
  tx_pos: number;
  value: number;
}

export const GetUtxos = async (
  address: string,
  network: "regtest" | "mainnet"
): Promise<TxOutResponse> => {
  const res = await axios.get(
    `http://localhost:6789/getunspent?address=${address}&network=${network}`
  );
  return res.data as TxOutResponse;
};
