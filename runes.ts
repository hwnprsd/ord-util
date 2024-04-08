import axios from "axios";
import { keys } from "@cmdcode/crypto-utils";
import { Tap, Address, Tx, Signer, Networks } from "@cmdcode/tapscript";
import {} from "@cmdcode/crypto-tools";

import { GetUtxos, TxOutPoint } from "./utxo";
import { scriptPubKey } from "@cmdcode/tapscript/dist/types/lib/addr/p2pkh";
import { networks } from "bitcoinjs-lib";

const PRIVATE_KEY_HEX =
  "13dd0981be5e6252320394c020b97ad11cbb1ff3c1ea48b65fbec25ebde2bbd1";

const INSC_DATA = '{"p":"brc-20","op":"mint","tick":"sdla","amt":"3"}';
const DEST_ADDR = "mw43A1J1GQksUbeAqnpgvT4xJjAkonxLVN";

const ec = new TextEncoder();

const encode = (s: string) => {
  return ec.encode(s);
};

const getAddress = (pubkey: any, network: Networks) => {
  const script = [pubkey, "OP_CHECKSIG"];
  const tapLeaf = Tap.encodeScript(script);
  const [tpubkey, cblock] = Tap.getPubKey(pubkey, { target: tapLeaf });
  const address = Address.p2tr.fromPubKey(tpubkey, network);
  return { address, tpubkey, script, cblock, tapLeaf };
};

const getInscriptionAddress = (pubkey: any, network: Networks) => {
  const encoder = new TextEncoder();
  const script = [pubkey, "OP_CHECKSIG", "OP_RETURN", "OP_13"];
  const tapLeaf = Tap.encodeScript(script);
  const [tpubkey, cblock] = Tap.getPubKey(pubkey, { target: tapLeaf });
  const address = Address.p2tr.fromPubKey(tpubkey, network);
  return { address, tpubkey, script, cblock, tapLeaf };
};

const main = async () => {
  const secKey = keys.get_seckey(PRIVATE_KEY_HEX);
  const pubkey = keys.get_pubkey(secKey, true);

  const { address, cblock, tpubkey, script, tapLeaf } = getAddress(
    pubkey,
    "regtest"
  );

  const utxos = await GetUtxos(address, "regtest");

  console.log("address =", address);
  console.log("utxolen =", utxos.result.length);

  let selectedUtxo: TxOutPoint = utxos.result[0];

  for (let i of utxos.result) {
    if (i.height > 3092) {
      continue;
    }
    if (i.value > 546) {
      selectedUtxo = i;
      break;
    }
  }

  console.log("utxo_value =", selectedUtxo.value);

  const {
    address: iAddress,
    tpubkey: iTPubkey,
    tapLeaf: iTapLeaf,
    cblock: iCblock,
    script: iScript,
  } = getInscriptionAddress(pubkey, "regtest");

  const FEE_RATE = 25;
  const minBaseUtxoAmt = 150 * FEE_RATE + 546;

  const commitTx = Tx.create({
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
        value: minBaseUtxoAmt,
        scriptPubKey: Address.toScriptPubKey(iAddress),
      },
    ],
  });

  const commitTxFee = (Tx.util.getTxSize(commitTx).vsize + 43) * FEE_RATE;
  const change = selectedUtxo.value - 1000 - commitTxFee;
  if (change > 546) {
    commitTx.vout.push({
      value: change,
      scriptPubKey: Address.toScriptPubKey(address),
    });
  }

  const sig = Signer.taproot.sign(secKey, commitTx, 0, { extension: tapLeaf });
  commitTx.vin[0].witness = [sig, script, cblock];
  Signer.taproot.verify(commitTx, 0, { pubkey, throws: true });

  const revealTx = Tx.create({
    vin: [
      {
        txid: Tx.util.getTxid(commitTx),
        vout: 0,
        prevout: { value: minBaseUtxoAmt, scriptPubKey: ["OP_1", iTPubkey] },
      },
    ],
    // This can be to anyone
    // vout: [{ value: 546, scriptPubKey: Address.toScriptPubKey(address) }],
    vout: [{ value: 546, scriptPubKey: Address.toScriptPubKey(DEST_ADDR) }],
  });

  const sig2 = Signer.taproot.sign(secKey, revealTx, 0, {
    extension: iTapLeaf,
  });
  revealTx.vin[0].witness = [sig2, iScript, iCblock];
  Signer.taproot.verify(revealTx, 0, { pubkey, throws: true });

  console.log();
  console.log(Tx.encode(commitTx).hex);
  console.log();
  console.log(Tx.encode(revealTx).hex);
  console.log();

  return;
};

main();