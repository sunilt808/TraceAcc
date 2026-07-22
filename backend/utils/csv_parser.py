import pandas as pd
import logging
from io import StringIO
from datetime import datetime, timedelta
from .graph import TransactionGraph

logger = logging.getLogger("trackacc")

# ---------------------------------------------------------------------------
# Known column‑name synonyms (lowercased).  Order matters: first match wins.
# ---------------------------------------------------------------------------
SENDER_KEYWORDS   = ['sender_id', 'sender', 'nameorig', 'source', 'from',
                     'origin', 'payer', 'originator', 'from_account',
                     'source_account', 'src']
RECEIVER_KEYWORDS = ['receiver_id', 'receiver', 'namedest', 'target', 'to',
                     'dest', 'beneficiary', 'payee', 'destination',
                     'to_account', 'dest_account', 'dst']
AMOUNT_KEYWORDS   = ['amount', 'value', 'amt', 'sum', 'transaction_amount',
                     'txn_amount', 'transfer_amount']
TIME_KEYWORDS     = ['timestamp', 'datetime', 'date', 'created', 'created_at',
                     'transaction_date', 'txn_date', 'time', 'test_date',
                     'step']
TX_ID_KEYWORDS    = ['transaction_id', 'txn_id', 'tx_id', 'id', 'trans_id']


def _find_col(columns: list[str], keywords: list[str],
              exclude: set[str] | None = None) -> str | None:
    """Find the best matching column from *columns* for a semantic role."""
    exclude = exclude or set()
    available = [c for c in columns if c not in exclude]

    # Pass 1 — exact match
    for kw in keywords:
        for col in available:
            if col == kw:
                return col

    # Pass 2 — column contains a keyword (prefer longer keyword match first)
    for kw in sorted(keywords, key=len, reverse=True):
        for col in available:
            if kw in col:
                return col

    return None


def _guess_id_columns(columns: list[str], exclude: set[str]) -> tuple[str | None, str | None]:
    """Heuristic: pick two string/ID‑like columns for sender & receiver."""
    candidates = [c for c in columns if c not in exclude]
    # Prefer columns whose name contains 'name', 'account', 'id', 'acc'
    id_hints = ['name', 'account', 'acc', 'id', 'party', 'entity', 'user',
                'customer', 'client']
    scored = []
    for col in candidates:
        score = sum(1 for h in id_hints if h in col)
        scored.append((score, col))
    scored.sort(key=lambda x: -x[0])
    picks = [col for _, col in scored[:2]]
    if len(picks) == 2:
        return picks[0], picks[1]
    elif len(picks) == 1:
        return picks[0], None
    return None, None


def parse_csv(file_content: str) -> TransactionGraph:
    """Parse a CSV string with *any* reasonable column naming into a
    TransactionGraph.  Supports:
      • Standard format (transaction_id, sender_id, receiver_id, amount, timestamp)
      • Kaggle Paysim (step, type, amount, nameOrig, …, nameDest, …)
      • Fraud‑export / scoring tables (id, transaction_id, amount, timestamp, …)
      • Arbitrary two‑party transaction logs
    """
    df = pd.read_csv(StringIO(file_content), low_memory=False)

    if df.empty:
        raise ValueError("CSV file is empty — no rows to analyze.")

    # Normalize headers
    original_columns = list(df.columns)
    df.columns = df.columns.str.strip().str.lower()
    cols = list(df.columns)

    logger.info("CSV columns detected: %s (%d rows)", cols, len(df))

    # ------------------------------------------------------------------
    # Step 1 — Map semantic roles via keyword matching
    # ------------------------------------------------------------------
    used: set[str] = set()

    amount_col = _find_col(cols, AMOUNT_KEYWORDS, used)
    if amount_col:
        used.add(amount_col)

    timestamp_col = _find_col(cols, TIME_KEYWORDS, used)
    if timestamp_col:
        used.add(timestamp_col)

    sender_col = _find_col(cols, SENDER_KEYWORDS, used)
    if sender_col:
        used.add(sender_col)

    receiver_col = _find_col(cols, RECEIVER_KEYWORDS, used)
    if receiver_col:
        used.add(receiver_col)

    txid_col = _find_col(cols, TX_ID_KEYWORDS, used)
    if txid_col:
        used.add(txid_col)

    # ------------------------------------------------------------------
    # Step 2 — Fallback heuristics for sender / receiver
    # ------------------------------------------------------------------
    if not sender_col or not receiver_col:
        g1, g2 = _guess_id_columns(cols, used)
        if not sender_col and g1:
            sender_col = g1
            used.add(g1)
        if not receiver_col and g2:
            receiver_col = g2
            used.add(g2)

    # Last‑resort: if only one of sender/receiver found and we have a
    # transaction_id column, treat the dataset as single‑party.
    # We will synthesize a second party from the transaction ID.
    single_party_mode = False
    if sender_col and not receiver_col:
        single_party_mode = True
        logger.warning("Only sender column '%s' found — using single-party mode.", sender_col)
    elif receiver_col and not sender_col:
        single_party_mode = True
        sender_col = receiver_col
        receiver_col = None
        logger.warning("Only receiver column '%s' found — swapping to sender, single-party mode.", sender_col)

    if not sender_col and not receiver_col:
        # Try to pick ANY two string columns as entity identifiers
        string_cols = []
        for c in cols:
            if c in used:
                continue
            sample = df[c].dropna().head(20)
            if sample.empty:
                continue
            # If majority look like non‑numeric strings, treat as ID
            non_numeric = sum(1 for v in sample if not _is_numeric(str(v)))
            if non_numeric > len(sample) * 0.5:
                string_cols.append(c)
        if len(string_cols) >= 2:
            sender_col, receiver_col = string_cols[0], string_cols[1]
            used.update([sender_col, receiver_col])
            logger.info("Auto-detected entity columns: sender='%s', receiver='%s'",
                        sender_col, receiver_col)
        elif len(string_cols) == 1:
            sender_col = string_cols[0]
            used.add(sender_col)
            single_party_mode = True
            logger.warning("Only one string column '%s' found — single-party mode.", sender_col)
        else:
            raise ValueError(
                f"Cannot identify sender/receiver columns. "
                f"Headers found: {cols}. "
                f"Please include columns for sender and receiver accounts."
            )

    # ------------------------------------------------------------------
    # Step 3 — Validate amount column
    # ------------------------------------------------------------------
    if not amount_col:
        # Try to find any numeric column that isn't already used
        for c in cols:
            if c in used:
                continue
            if pd.to_numeric(df[c], errors='coerce').notna().sum() > len(df) * 0.5:
                amount_col = c
                used.add(c)
                logger.info("Auto-detected amount column: '%s'", c)
                break

    if not amount_col:
        raise ValueError(
            f"Cannot identify an amount column. Headers: {cols}. "
            f"Need a numeric column for transaction amounts."
        )

    # ------------------------------------------------------------------
    # Step 4 — Coerce types
    # ------------------------------------------------------------------
    df['_amount'] = pd.to_numeric(df[amount_col], errors='coerce')

    # Timestamp handling — may be a real datetime, a unix epoch, or a
    # numeric "step" (like Kaggle Paysim).
    has_timestamp = False
    if timestamp_col:
        # Try standard datetime parse first
        parsed_ts = pd.to_datetime(df[timestamp_col], errors='coerce')
        if parsed_ts.notna().sum() > len(df) * 0.3:
            df['_timestamp'] = parsed_ts
            has_timestamp = True
        else:
            # Maybe it's a numeric step/epoch
            numeric_ts = pd.to_numeric(df[timestamp_col], errors='coerce')
            if numeric_ts.notna().sum() > len(df) * 0.5:
                # If values are small (< 100k), treat as "step" → synthesize
                if numeric_ts.max() < 1e8:
                    base = datetime(2025, 1, 1)
                    df['_timestamp'] = numeric_ts.apply(
                        lambda s: base + timedelta(hours=float(s)) if pd.notna(s) else pd.NaT
                    )
                    has_timestamp = True
                    logger.info("Treating '%s' as step-based time (hours from epoch).", timestamp_col)
                else:
                    # Treat as unix timestamp
                    df['_timestamp'] = pd.to_datetime(numeric_ts, unit='s', errors='coerce')
                    has_timestamp = True
                    logger.info("Treating '%s' as unix epoch seconds.", timestamp_col)

    if not has_timestamp:
        # Synthesize sequential timestamps so detectors don't crash
        logger.warning("No usable timestamp column — generating synthetic timestamps.")
        base = datetime(2025, 1, 1)
        df['_timestamp'] = [base + timedelta(minutes=i) for i in range(len(df))]

    # ------------------------------------------------------------------
    # Step 5 — Build graph
    # ------------------------------------------------------------------
    graph = TransactionGraph()
    skipped = 0

    for _, row in df.iterrows():
        if pd.isna(row['_amount']) or pd.isna(row['_timestamp']):
            skipped += 1
            continue

        sender = str(row[sender_col]).strip()

        if single_party_mode or not receiver_col:
            # Synthesize receiver from transaction ID or row index
            if txid_col:
                receiver = f"COUNTER_{str(row[txid_col]).strip()}"
            else:
                receiver = f"COUNTER_{sender}"
        else:
            receiver = str(row[receiver_col]).strip()

        # Skip if sender == receiver (self-loops are meaningless for muling)
        if sender == receiver:
            skipped += 1
            continue

        graph.add_transaction(
            sender=sender,
            receiver=receiver,
            amount=float(row['_amount']),
            timestamp=row['_timestamp']
        )

    logger.info(
        "Parsed %d transactions (%d skipped). Mapped: sender='%s', receiver='%s', "
        "amount='%s', timestamp='%s'",
        len(graph.transactions), skipped,
        sender_col, receiver_col or "(synthesized)",
        amount_col, timestamp_col or "(synthesized)"
    )

    if len(graph.transactions) == 0:
        raise ValueError(
            "No valid transactions found after parsing. "
            "Check that the CSV has numeric amounts and recognizable account columns."
        )

    return graph


def _is_numeric(s: str) -> bool:
    """Check if a string looks numeric."""
    try:
        float(s.replace(',', ''))
        return True
    except (ValueError, AttributeError):
        return False
