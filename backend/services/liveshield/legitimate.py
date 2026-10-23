"""
legitimate.py — Generator for plausible synthetic legitimate transactions.

Supports 12 realistic financial transaction categories with configurable statistical
distributions, account profile alignment, and Decimal precision.
"""
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import random
from typing import Dict, Any, Optional
from services.liveshield.accounts import AccountPopulation, SyntheticAccount


# 12 Legitimate Categories Definitions & Value Ranges
CATEGORY_SPECS = {
    "p2p": {"mean": Decimal("85.00"), "std": Decimal("40.00"), "min": Decimal("5.00"), "max": Decimal("1500.00"), "channel": "MOBILE"},
    "merchant": {"mean": Decimal("65.00"), "std": Decimal("35.00"), "min": Decimal("2.00"), "max": Decimal("800.00"), "channel": "POS"},
    "salary": {"mean": Decimal("3200.00"), "std": Decimal("800.00"), "min": Decimal("1200.00"), "max": Decimal("15000.00"), "channel": "ACH"},
    "bill": {"mean": Decimal("140.00"), "std": Decimal("60.00"), "min": Decimal("20.00"), "max": Decimal("1200.00"), "channel": "ONLINE"},
    "subscription": {"mean": Decimal("19.99"), "std": Decimal("5.00"), "min": Decimal("4.99"), "max": Decimal("99.99"), "channel": "CARD_ON_FILE"},
    "ecommerce": {"mean": Decimal("95.00"), "std": Decimal("55.00"), "min": Decimal("10.00"), "max": Decimal("2500.00"), "channel": "WEB"},
    "refund": {"mean": Decimal("50.00"), "std": Decimal("30.00"), "min": Decimal("5.00"), "max": Decimal("500.00"), "channel": "ONLINE"},
    "b2b": {"mean": Decimal("12500.00"), "std": Decimal("4500.00"), "min": Decimal("1000.00"), "max": Decimal("95000.00"), "channel": "WIRE"},
    "recurring": {"mean": Decimal("250.00"), "std": Decimal("80.00"), "min": Decimal("50.00"), "max": Decimal("1800.00"), "channel": "AUTO_DEBIT"},
    "everyday": {"mean": Decimal("12.50"), "std": Decimal("6.00"), "min": Decimal("1.50"), "max": Decimal("45.00"), "channel": "CONTACTLESS"},
    "high_value": {"mean": Decimal("18000.00"), "std": Decimal("6000.00"), "min": Decimal("5000.00"), "max": Decimal("85000.00"), "channel": "WIRE"},
    "international": {"mean": Decimal("850.00"), "std": Decimal("400.00"), "min": Decimal("50.00"), "max": Decimal("12000.00"), "channel": "SWIFT"},
}


class LegitimateTransactionGenerator:
    def __init__(
        self,
        population: AccountPopulation,
        category_weights: Optional[Dict[str, Decimal]] = None,
        min_amount: Decimal = Decimal("1.00"),
        max_amount: Decimal = Decimal("50000.00"),
        currency: str = "USD",
        txn_prefix: str = "TXN",
        seed: Optional[int] = None,
    ):
        self.population = population
        self.rng = random.Random(seed)
        self.min_amount = min_amount
        self.max_amount = max_amount
        self.currency = currency
        self.txn_prefix = txn_prefix
        self.counter = 1

        # Normalize category weights
        raw_weights = category_weights or {k: Decimal("10.0") for k in CATEGORY_SPECS}
        self.categories = list(CATEGORY_SPECS.keys())
        self.weights = [float(raw_weights.get(k, Decimal("1.0"))) for k in self.categories]

    def _sample_amount(self, category: str) -> Decimal:
        spec = CATEGORY_SPECS[category]
        mean = float(spec["mean"])
        std = float(spec["std"])
        
        # Log-normal or gaussian sampling
        raw_val = abs(self.rng.gauss(mean, std))
        val = max(float(spec["min"]), min(float(spec["max"]), raw_val))
        val = max(float(self.min_amount), min(float(self.max_amount), val))
        
        # Quantize to exact 2 decimal places
        dec = Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return dec if dec > Decimal("0.00") else Decimal("1.00")

    def generate_single_transaction(
        self,
        timestamp: Optional[datetime] = None,
        sequence_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate one statistically realistic legitimate transaction."""
        now = timestamp or datetime.now(timezone.utc)
        category = self.rng.choices(self.categories, weights=self.weights, k=1)[0]
        spec = CATEGORY_SPECS[category]

        sender, receiver = self.population.sample_pair(category)
        amount = self._sample_amount(category)

        # Apply virtual balance reconciliation
        sender.debit(amount)
        receiver.credit(amount)

        txn_id = f"{self.txn_prefix}{self.counter:08d}"
        self.counter += 1

        dest_country = receiver.country
        if category == "international":
            foreign_countries = [c for c in ["GB", "DE", "FR", "SG", "JP", "CH", "AE"] if c != sender.country]
            dest_country = self.rng.choice(foreign_countries)

        return {
            "transaction_id": txn_id,
            "sequence_id": sequence_id,
            "step_index": 0,
            "sender_account": sender.account_id,
            "receiver_account": receiver.account_id,
            "amount": amount,
            "currency": self.currency,
            "transaction_type": category.upper(),
            "channel": spec["channel"],
            "timestamp": now,
            "scheduled_timestamp": now,
            "generated_timestamp": datetime.now(timezone.utc),
            "source_country": sender.country,
            "dest_country": dest_country,
            "device_id": sender.device_id,
            "merchant_id": receiver.account_id if receiver.account_type == "MERCHANT" else None,
            "scenario_id": None,
            "synthetic_ground_truth": "legitimate",
            "account_ground_truth": "legitimate",
            "sequence_ground_truth": None,
            "scenario_metadata": {
                "category": category,
                "is_known_beneficiary": receiver.account_id in sender.known_beneficiaries,
            },
            "is_synthetic": True,
        }
