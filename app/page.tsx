"use client";

import { useState } from "react";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x76B4E91B4743AB0a9F74831a489E4Ff0d8c48518") as `0x${string}`;

type Receipt = { id: string; verdict: string; reason: string };

function getClient() {
  let key = localStorage.getItem("dc_key");
  if (!key) {
    key = generatePrivateKey();
    localStorage.setItem("dc_key", key);
  }
  return createClient({
    chain: studionet,
    account: createAccount(key as `0x${string}`),
  });
}

function toReceipt(id: string, raw: any): Receipt {
  if (raw === "NOT_FOUND") return { id, verdict: "NOT_FOUND", reason: "No result with this id yet." };
  try {
    const d = JSON.parse(String(raw));
    return { id, verdict: d.verdict, reason: d.reason };
  } catch {
    return { id, verdict: "UNCLEAR", reason: "Could not read the saved result." };
  }
}

const LABEL: Record<string, string> = {
  DELIVERED: "Delivered",
  NOT_DELIVERED: "Not delivered",
  UNCLEAR: "Unclear",
  NOT_FOUND: "Not found",
};

export default function Home() {
  const [task, setTask] = useState("");
  const [url, setUrl] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  async function runCheck() {
    setError("");
    setReceipt(null);
    if (!task.trim() || task.length > 500) return setError("Write the task in 1 to 500 characters.");
    if (!url.trim() || url.length > 200) return setError("Add a page link of up to 200 characters.");
    setBusy(true);
    try {
      const client = getClient();
      setStatus("Reading the next receipt number...");
      const nextId = String(
        await client.readContract({ address: ADDRESS, functionName: "next_id", args: [] })
      );
      setStatus("Sending your check. Validators are reading the page. This can take a minute or two.");
      const hash = await client.writeContract({
        address: ADDRESS,
        functionName: "check",
        args: [task.trim(), url.trim()],
        value: BigInt(0),
      });
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 120,
        interval: 3000,
      });
      setStatus("Reading the verdict...");
      const raw = await client.readContract({
        address: ADDRESS,
        functionName: "get_result",
        args: [nextId],
      });
      setReceipt(toReceipt(nextId, raw));
    } catch (e: any) {
      setError("The check did not finish: " + String(e?.message || e).slice(0, 200));
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function runLookup() {
    setError("");
    setReceipt(null);
    if (!/^\d+$/.test(lookupId.trim())) return setError("Receipt numbers are whole numbers, like 0 or 12.");
    setBusy(true);
    try {
      const client = getClient();
      const raw = await client.readContract({
        address: ADDRESS,
        functionName: "get_result",
        args: [lookupId.trim()],
      });
      setReceipt(toReceipt(lookupId.trim(), raw));
    } catch (e: any) {
      setError("Could not read that receipt: " + String(e?.message || e).slice(0, 200));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <h1>DeliverCheck</h1>
        <p className="lede">
          Describe what was promised, link the page that should show it, and get a public verdict anyone can look up later.
        </p>
      </header>

      <section className="panel">
        <label htmlFor="task">What was promised?</label>
        <textarea
          id="task"
          rows={4}
          maxLength={500}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="The page shows a pricing table with three paid plans"
        />
        <div className="count">{task.length} / 500</div>

        <label htmlFor="url">Page link</label>
        <input
          id="url"
          type="url"
          maxLength={200}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/page"
        />

        <button onClick={runCheck} disabled={busy}>
          {busy ? "Checking..." : "Check delivery"}
        </button>
        {status && <p className="status" role="status">{status}</p>}
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      {receipt && (
        <section className={"slip " + receipt.verdict}>
          <div className="slip-top">Receipt {receipt.id}</div>
          <div className="verdict">{LABEL[receipt.verdict] || receipt.verdict}</div>
          <p>{receipt.reason}</p>
        </section>
      )}

      <section className="panel lookup">
        <label htmlFor="rid">Look up a receipt</label>
        <div className="row">
          <input
            id="rid"
            inputMode="numeric"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="Receipt number, like 0"
          />
          <button className="secondary" onClick={runLookup} disabled={busy}>
            Look up
          </button>
        </div>
      </section>
    </main>
  );
}
