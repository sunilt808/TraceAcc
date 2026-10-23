"""
accounts.py — Reusable synthetic account and population generator with Decimal balance tracking.

Provides stable synthetic account IDs, profiles (Personal, Business, Merchant, Dormant),
balance tracking, device IDs, and geographic metadata.
"""
from dataclasses import dataclass, field
from decimal import Decimal
import random
from typing import Dict, List, Optional, Set


@dataclass
class SyntheticAccount:
    account_id: str
    account_type: str  # 'PERSONAL', 'BUSINESS', 'MERCHANT', 'DORMANT'
    balance: Decimal
    currency: str = "USD"
    country: str = "US"
    typical_amount_mean: Decimal = Decimal("150.00")
    typical_amount_std: Decimal = Decimal("50.00")
    active_hours: List[int] = field(default_factory=lambda: list(range(8, 22)))  # 8 AM to 10 PM
    known_beneficiaries: Set[str] = field(default_factory=set)
    device_id: str = ""
    merchant_category: Optional[str] = None
    is_dormant: bool = False
    transaction_count: int = 0

    def debit(self, amount: Decimal) -> bool:
        """Attempt to debit account if sufficient balance or credit buffer."""
        if self.balance >= amount or self.account_type in ("BUSINESS", "MERCHANT"):
            self.balance -= amount
            self.transaction_count += 1
            return True
        return False

    def credit(self, amount: Decimal) -> None:
        """Credit account balance."""
        self.balance += amount
        self.transaction_count += 1


class AccountPopulation:
    def __init__(
        self,
        num_accounts: int = 60,
        personal_ratio: Decimal = Decimal("0.75"),
        business_ratio: Decimal = Decimal("0.20"),
        merchant_ratio: Decimal = Decimal("0.05"),
        dormant_ratio: Decimal = Decimal("0.05"),
        syndicate_ratio: Decimal = Decimal("0.20"),
        currency: str = "USD",
        seed: Optional[int] = None,
    ):
        self.rng = random.Random(seed)
        self.currency = currency
        self.accounts: Dict[str, SyntheticAccount] = {}
        self.account_ids: List[str] = []
        self.personal_ids: List[str] = []
        self.business_ids: List[str] = []
        self.merchant_ids: List[str] = []
        self.dormant_ids: List[str] = []
        self.syndicate_ids: List[str] = []
        self.clean_ids: List[str] = []

        self._generate_population(
            num_accounts,
            personal_ratio,
            business_ratio,
            merchant_ratio,
            dormant_ratio,
            syndicate_ratio,
        )

    def _generate_population(
        self,
        num_accounts: int,
        personal_ratio: Decimal,
        business_ratio: Decimal,
        merchant_ratio: Decimal,
        dormant_ratio: Decimal,
        syndicate_ratio: Decimal = Decimal("0.20"),
    ):
        countries = ["US", "US", "US", "GB", "CA", "DE", "FR", "SG", "AU"]
        merchant_categories = ["RETAIL", "GROCERY", "ELECTRONICS", "UTILITIES", "TRAVEL", "SERVICES"]

        for i in range(1, num_accounts + 1):
            acc_id = f"ACC{i:04d}"
            r = self.rng.random()
            
            # Determine account type
            if r < float(personal_ratio):
                acc_type = "PERSONAL"
                balance = Decimal(str(self.rng.randint(2000, 25000)))
                mean_amt = Decimal(str(self.rng.randint(25, 300)))
            elif r < float(personal_ratio + business_ratio):
                acc_type = "BUSINESS"
                balance = Decimal(str(self.rng.randint(50000, 500000)))
                mean_amt = Decimal(str(self.rng.randint(500, 8000)))
            else:
                acc_type = "MERCHANT"
                balance = Decimal(str(self.rng.randint(100000, 1000000)))
                mean_amt = Decimal(str(self.rng.randint(50, 1500)))

            is_dormant = self.rng.random() < float(dormant_ratio)
            if is_dormant:
                acc_type = "DORMANT"
                balance = Decimal(str(self.rng.randint(5000, 50000)))

            country = self.rng.choice(countries)
            device_id = f"DEV-{self.rng.randint(100000, 999999)}"
            merchant_cat = self.rng.choice(merchant_categories) if acc_type == "MERCHANT" else None

            account = SyntheticAccount(
                account_id=acc_id,
                account_type=acc_type,
                balance=balance,
                currency=self.currency,
                country=country,
                typical_amount_mean=mean_amt,
                typical_amount_std=mean_amt * Decimal("0.3"),
                device_id=device_id,
                merchant_category=merchant_cat,
                is_dormant=is_dormant,
            )

            self.accounts[acc_id] = account
            self.account_ids.append(acc_id)
            if acc_type == "PERSONAL":
                self.personal_ids.append(acc_id)
            elif acc_type == "BUSINESS":
                self.business_ids.append(acc_id)
            elif acc_type == "MERCHANT":
                self.merchant_ids.append(acc_id)
            elif acc_type == "DORMANT":
                self.dormant_ids.append(acc_id)

        # Partition dedicated mule syndicate ring from clean accounts
        num_syndicate = max(4, int(num_accounts * float(syndicate_ratio)))
        # Syndicate accounts are drawn primarily from personal/dormant accounts
        syndicate_candidates = [a for a in (self.personal_ids + self.dormant_ids) if a in self.accounts]
        if len(syndicate_candidates) >= num_syndicate:
            self.syndicate_ids = list(syndicate_candidates[:num_syndicate])
        else:
            self.syndicate_ids = list(self.account_ids[:num_syndicate])
        self.clean_ids = [a for a in self.account_ids if a not in self.syndicate_ids]

        # Pre-populate known beneficiaries for realism
        for acc_id, acc in self.accounts.items():
            if acc.account_type == "PERSONAL":
                num_known = self.rng.randint(2, 6)
                other_accounts = [a for a in self.account_ids if a != acc_id]
                if other_accounts:
                    acc.known_beneficiaries = set(self.rng.sample(other_accounts, min(num_known, len(other_accounts))))

    def get_syndicate_population(self) -> "AccountPopulation":
        """Return a subpopulation view restricted to illicit syndicate / mule actors."""
        sub = AccountPopulation.__new__(AccountPopulation)
        sub.rng = self.rng
        sub.currency = self.currency
        sub.accounts = {a: self.accounts[a] for a in self.syndicate_ids if a in self.accounts}
        sub.account_ids = list(sub.accounts.keys())
        sub.personal_ids = [a for a in self.personal_ids if a in sub.accounts]
        sub.business_ids = [a for a in self.business_ids if a in sub.accounts]
        sub.merchant_ids = [a for a in self.merchant_ids if a in sub.accounts]
        sub.dormant_ids = [a for a in self.dormant_ids if a in sub.accounts]
        sub.syndicate_ids = list(sub.account_ids)
        sub.clean_ids = []
        return sub

    def get_account(self, account_id: str) -> Optional[SyntheticAccount]:
        return self.accounts.get(account_id)

    def sample_pair(self, category: str = "p2p") -> tuple[SyntheticAccount, SyntheticAccount]:
        """Sample a plausible sender and receiver pair according to transaction category."""
        if category == "merchant" and self.merchant_ids and self.personal_ids:
            sender = self.accounts[self.rng.choice(self.personal_ids)]
            receiver = self.accounts[self.rng.choice(self.merchant_ids)]
            return sender, receiver

        if category == "salary" and self.business_ids and self.personal_ids:
            sender = self.accounts[self.rng.choice(self.business_ids)]
            receiver = self.accounts[self.rng.choice(self.personal_ids)]
            return sender, receiver

        if category == "b2b" and len(self.business_ids) >= 2:
            s_id, r_id = self.rng.sample(self.business_ids, 2)
            return self.accounts[s_id], self.accounts[r_id]

        # Default P2P or general pair
        available = self.personal_ids or self.account_ids
        if len(available) >= 2:
            s_id, r_id = self.rng.sample(available, 2)
            return self.accounts[s_id], self.accounts[r_id]
        elif len(self.account_ids) >= 2:
            s_id, r_id = self.rng.sample(self.account_ids, 2)
            return self.accounts[s_id], self.accounts[r_id]
        else:
            # Fallback if extremely small pool
            s_id = self.account_ids[0]
            r_id = f"ACC_EXT_{self.rng.randint(100, 999)}"
            dummy_r = SyntheticAccount(account_id=r_id, account_type="PERSONAL", balance=Decimal("10000.00"))
            return self.accounts[s_id], dummy_r
