import axios from "axios";
import { keys } from "@cmdcode/crypto-utils";
import { Tap, Address, Tx, Signer } from "@cmdcode/tapscript";
import { GetUtxos, TxOutPoint } from "./utxo";
import { scriptPubKey } from "@cmdcode/tapscript/dist/types/lib/addr/p2pkh";

const PRIVATE_KEY_HEX =
  "13dd0981be5e6252320394c020b97ad11cbb1ff3c1ea48b65fbec25ebde2bbd1";

const main = async () => {
  const secKey = keys.get_seckey(PRIVATE_KEY_HEX);
  const pubkey = keys.get_pubkey(secKey, true);

  const [tseckey] = Tap.getSecKey(secKey);
  const [tpubkey] = Tap.getPubKey(pubkey);

  const address = Address.p2tr.fromPubKey(tpubkey, "regtest");

  const utxos = await GetUtxos(address, "regtest");

  console.log("address =", address);
  console.log("utxolen =", utxos.result.length);

  let selectedUtxo: TxOutPoint = utxos.result[0];

  for (let i of utxos.result) {
    if (i.value > 546) {
      selectedUtxo = i;
      break;
    }
  }

  console.log("utxo_value =", selectedUtxo.value);

  // Send inscriptions doing this
  const txdata = Tx.create({
    vin: [
      {
        txid: selectedUtxo.tx_hash,
        vout: selectedUtxo.tx_pos,
        prevout: {
          value: selectedUtxo.value,
          scriptPubKey: ["OP_1", tpubkey],
        },
      },
    ],
    vout: [
      {
        value: 1000,
        scriptPubKey: Address.toScriptPubKey(
          "bcrt1qwtxyfywd9apvw93f43da8n4u73nn8eeqrzckvy"
        ),
      },
      {
        value: selectedUtxo.value - 1000 - 5000,
        scriptPubKey: Address.toScriptPubKey(address),
      },
    ],
  });

  const sig = Signer.taproot.sign(tseckey, txdata, 0);
  txdata.vin[0].witness = [sig];
  console.log(Signer.taproot.verify(txdata, 0));
  console.log(Tx.encode(txdata).hex);
};

main();
