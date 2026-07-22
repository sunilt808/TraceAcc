import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class GeneratorParams(BaseModel):
    numAccounts: int
    numTransactions: int
    minAmount: float
    maxAmount: float
    startDate: str
    endDate: str
    maxPerAccount: int
    datasetType: str  # 'unique', 'repeated', or 'mixed'
    txnPrefix: str
    includeCycles: bool = False
    includeFan: bool = False
    includeLayering: bool = False

def generate_cycle(accounts, txn_id_base, amount_range, time_window, txn_prefix, index):
    """Generate a 3-cycle A->B->C->A."""
    if len(accounts) < 3:
        return None
    a, b, c = random.sample(accounts, 3)
    timestamp = time_window[0] + timedelta(seconds=random.randint(0, int((time_window[1]-time_window[0]).total_seconds())))
    amount = round(random.uniform(*amount_range), 2)
    transactions = []
    # A->B
    transactions.append({
        "transaction_id": f"{txn_prefix}{index:06d}",
        "sender_id": a,
        "receiver_id": b,
        "amount": amount,
        "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S")
    })
    index += 1
    # B->C
    transactions.append({
        "transaction_id": f"{txn_prefix}{index:06d}",
        "sender_id": b,
        "receiver_id": c,
        "amount": amount,
        "timestamp": (timestamp + timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S")
    })
    index += 1
    # C->A
    transactions.append({
        "transaction_id": f"{txn_prefix}{index:06d}",
        "sender_id": c,
        "receiver_id": a,
        "amount": amount,
        "timestamp": (timestamp + timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")
    })
    return transactions, index

def generate_fan_pattern(accounts, amount_range, time_window, txn_prefix, index, fan_type='in', num=10):
    """Generate fan-in (many to one) or fan-out (one to many) pattern."""
    if len(accounts) < num+1:
        return None, index
    if fan_type == 'in':
        receiver = random.choice(accounts)
        senders = random.sample([a for a in accounts if a != receiver], num)
        base_time = time_window[0] + timedelta(seconds=random.randint(0, int((time_window[1]-time_window[0]).total_seconds())))
        transactions = []
        for i, sender in enumerate(senders):
            amount = round(random.uniform(*amount_range), 2)
            txn_time = base_time + timedelta(hours=random.randint(0, 72))
            transactions.append({
                "transaction_id": f"{txn_prefix}{index:06d}",
                "sender_id": sender,
                "receiver_id": receiver,
                "amount": amount,
                "timestamp": txn_time.strftime("%Y-%m-%d %H:%M:%S")
            })
            index += 1
    else:  # fan-out
        sender = random.choice(accounts)
        receivers = random.sample([a for a in accounts if a != sender], num)
        base_time = time_window[0] + timedelta(seconds=random.randint(0, int((time_window[1]-time_window[0]).total_seconds())))
        transactions = []
        for i, receiver in enumerate(receivers):
            amount = round(random.uniform(*amount_range), 2)
            txn_time = base_time + timedelta(hours=random.randint(0, 72))
            transactions.append({
                "transaction_id": f"{txn_prefix}{index:06d}",
                "sender_id": sender,
                "receiver_id": receiver,
                "amount": amount,
                "timestamp": txn_time.strftime("%Y-%m-%d %H:%M:%S")
            })
            index += 1
    return transactions, index

def generate_layered_shell(accounts, amount_range, time_window, txn_prefix, index, chain_length=3):
    """Generate a chain of length chain_length where intermediate nodes are low-degree (by design)."""
    if len(accounts) < chain_length + 1:
        return None, index
    # Pick a start, then chain_length intermediate, then end
    nodes = random.sample(accounts, chain_length + 1)
    transactions = []
    base_time = time_window[0] + timedelta(seconds=random.randint(0, int((time_window[1]-time_window[0]).total_seconds())))
    for i in range(chain_length):
        amount = round(random.uniform(*amount_range), 2)
        txn_time = base_time + timedelta(hours=random.randint(1, 12) * (i+1))
        transactions.append({
            "transaction_id": f"{txn_prefix}{index:06d}",
            "sender_id": nodes[i],
            "receiver_id": nodes[i+1],
            "amount": amount,
            "timestamp": txn_time.strftime("%Y-%m-%d %H:%M:%S")
        })
        index += 1
    return transactions, index

def generate_synthetic_dataset(params: GeneratorParams) -> List[Dict[str, Any]]:
    """Generate synthetic transaction data with optional pattern injection."""
    start = datetime.strptime(params.startDate, "%Y-%m-%d")
    end = datetime.strptime(params.endDate, "%Y-%m-%d")
    delta = end - start
    time_window = (start, end)

    accounts = [f"ACC{i:03d}" for i in range(1, params.numAccounts + 1)]

    transactions = []
    used_pairs = set()
    account_txn_count = {acc: 0 for acc in accounts}
    txn_index = 1

    # Determine how many pattern transactions to generate (if any)
    pattern_count = 0
    if params.includeCycles:
        pattern_count += 3  # each cycle uses 3 txns
    if params.includeFan:
        pattern_count += 10  # fan patterns use 10 txns each
    if params.includeLayering:
        pattern_count += 3   # layered shell uses 3 txns
    # We'll generate at most 10% of total transactions as patterns, but at least enough to include selected patterns
    max_pattern_txns = int(params.numTransactions * 0.1)
    actual_pattern_txns = min(pattern_count, max_pattern_txns)

    # Generate pattern transactions
    if params.includeCycles:
        cycles_needed = min(1, max_pattern_txns // 3)  # at least 1 cycle if possible
        for _ in range(cycles_needed):
            res = generate_cycle(accounts, params.txnPrefix, (params.minAmount, params.maxAmount), time_window, params.txnPrefix, txn_index)
            if res:
                cyc_txns, txn_index = res
                transactions.extend(cyc_txns)
                # Update account counts (simplified - not checking maxPerAccount for patterns to keep simple)
                for t in cyc_txns:
                    account_txn_count[t['sender_id']] = account_txn_count.get(t['sender_id'], 0) + 1
                    account_txn_count[t['receiver_id']] = account_txn_count.get(t['receiver_id'], 0) + 1
                    used_pairs.add((t['sender_id'], t['receiver_id']))

    if params.includeFan:
        fan_txns, txn_index = generate_fan_pattern(accounts, (params.minAmount, params.maxAmount), time_window, params.txnPrefix, txn_index, fan_type='in', num=10)
        if fan_txns:
            transactions.extend(fan_txns)
            for t in fan_txns:
                account_txn_count[t['sender_id']] = account_txn_count.get(t['sender_id'], 0) + 1
                account_txn_count[t['receiver_id']] = account_txn_count.get(t['receiver_id'], 0) + 1
                used_pairs.add((t['sender_id'], t['receiver_id']))

    if params.includeLayering:
        layer_txns, txn_index = generate_layered_shell(accounts, (params.minAmount, params.maxAmount), time_window, params.txnPrefix, txn_index, chain_length=3)
        if layer_txns:
            transactions.extend(layer_txns)
            for t in layer_txns:
                account_txn_count[t['sender_id']] = account_txn_count.get(t['sender_id'], 0) + 1
                account_txn_count[t['receiver_id']] = account_txn_count.get(t['receiver_id'], 0) + 1
                used_pairs.add((t['sender_id'], t['receiver_id']))

    # Fill remaining transactions with random data
    remaining = params.numTransactions - len(transactions)
    for _ in range(remaining):
        # Determine if unique, repeated, or mixed
        if params.datasetType == 'unique':
            # Generate unique pair
            attempts = 0
            while True:
                sender = random.choice(accounts)
                receiver = random.choice(accounts)
                if sender != receiver and (sender, receiver) not in used_pairs:
                    break
                attempts += 1
                if attempts > 1000:
                    raise ValueError("Cannot generate enough unique transactions. Try increasing accounts or switching to repeated/mixed.")
            used_pairs.add((sender, receiver))
        elif params.datasetType == 'repeated':
            # Allow any pair
            sender = random.choice(accounts)
            receiver = random.choice(accounts)
            while sender == receiver:
                receiver = random.choice(accounts)
        else:  # mixed - randomly choose unique or repeated each time
            if random.random() < 0.5:  # 50% unique
                attempts = 0
                while True:
                    sender = random.choice(accounts)
                    receiver = random.choice(accounts)
                    if sender != receiver and (sender, receiver) not in used_pairs:
                        used_pairs.add((sender, receiver))
                        break
                    attempts += 1
                    if attempts > 1000:
                        # fallback to repeated
                        sender = random.choice(accounts)
                        receiver = random.choice(accounts)
                        while sender == receiver:
                            receiver = random.choice(accounts)
                        break
            else:
                sender = random.choice(accounts)
                receiver = random.choice(accounts)
                while sender == receiver:
                    receiver = random.choice(accounts)

        # Check max per account
        if account_txn_count.get(sender, 0) >= params.maxPerAccount or account_txn_count.get(receiver, 0) >= params.maxPerAccount:
            # Skip this transaction (try again) – for simplicity, we'll just decrement i and continue
            # but to avoid infinite loop, we'll just assign random accounts that are under limit
            candidates = [acc for acc in accounts if account_txn_count.get(acc, 0) < params.maxPerAccount]
            if len(candidates) < 2:
                raise ValueError("Max per account limit reached for all accounts. Cannot generate more transactions.")
            sender = random.choice(candidates)
            receiver = random.choice([a for a in candidates if a != sender])

        account_txn_count[sender] = account_txn_count.get(sender, 0) + 1
        account_txn_count[receiver] = account_txn_count.get(receiver, 0) + 1

        random_seconds = random.randint(0, int(delta.total_seconds()))
        txn_time = start + timedelta(seconds=random_seconds)
        amount = round(random.uniform(params.minAmount, params.maxAmount), 2)
        txn_id = f"{params.txnPrefix}{txn_index:06d}"
        txn_index += 1

        transactions.append({
            "transaction_id": txn_id,
            "sender_id": sender,
            "receiver_id": receiver,
            "amount": amount,
            "timestamp": txn_time.strftime("%Y-%m-%d %H:%M:%S")
        })

    # Ensure we have exactly the requested number of transactions (in case pattern generation added fewer due to constraints)
    if len(transactions) < params.numTransactions:
        # Fill with simple random (ignoring patterns) - simplified
        while len(transactions) < params.numTransactions:
            sender = random.choice(accounts)
            receiver = random.choice([a for a in accounts if a != sender])
            random_seconds = random.randint(0, int(delta.total_seconds()))
            txn_time = start + timedelta(seconds=random_seconds)
            amount = round(random.uniform(params.minAmount, params.maxAmount), 2)
            txn_id = f"{params.txnPrefix}{txn_index:06d}"
            txn_index += 1
            transactions.append({
                "transaction_id": txn_id,
                "sender_id": sender,
                "receiver_id": receiver,
                "amount": amount,
                "timestamp": txn_time.strftime("%Y-%m-%d %H:%M:%S")
            })

    return transactions[:params.numTransactions]  # trim if overshot